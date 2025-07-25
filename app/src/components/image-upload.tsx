import { useState, useCallback } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ImageUploadProps {
  maxFiles?: number;
  onImagesChange: (ipfsHashes: string[]) => void;
  disabled?: boolean;
  getAuthToken: () => Promise<string>;
}

interface UploadedImage {
  ipfsHash: string;
  gatewayUrl: string;
  file: File;
  preview: string;
}

export function ImageUpload({ 
  maxFiles = 10, 
  onImagesChange,
  disabled = false,
  getAuthToken
}: ImageUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    if (images.length + fileArray.length > maxFiles) {
      toast.error(`最多只能上傳 ${maxFiles} 張圖片`);
      return;
    }

    const validFiles = fileArray.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} 不是圖片檔案`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} 超過 10MB 大小限制`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    
    try {
      const optimizedFiles = await Promise.all(
        validFiles.map(file => optimizeImage(file))
      );
      
      const formData = new FormData();
      optimizedFiles.forEach(file => {
        formData.append('images', file);
      });

      const token = await getAuthToken();
      
      const response = await fetch('/api/ipfs/upload-images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      const newImages = await Promise.all(
        result.images.map(async (img: any, index: number) => ({
          ipfsHash: img.ipfsHash,
          gatewayUrl: img.gatewayUrl,
          file: optimizedFiles[index],
          preview: await createPreview(optimizedFiles[index])
        }))
      );

      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      onImagesChange(updatedImages.map(img => img.ipfsHash));
      
      toast.success(`成功上傳 ${result.count} 張圖片`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('圖片上傳失敗');
    } finally {
      setUploading(false);
    }
  }, [images, maxFiles, onImagesChange, getAuthToken]);

  const createPreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  };

  const optimizeImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (file.size < 1024 * 1024) {
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          let width = img.width;
          let height = img.height;
          const maxSize = 1920;
          
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const optimizedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(optimizedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChange(newImages.map(img => img.ipfsHash));
  }, [images, onImagesChange]);

  return (
    <div className="space-y-4">
      {/* 圖片預覽網格 */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((image, index) => (
            <div key={image.ipfsHash} className="relative group aspect-square">
              <img
                src={image.preview}
                alt={`圖片 ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border"
              />
              {index === 0 && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                  封面
                </div>
              )}
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 上傳按鈕 */}
      {images.length < maxFiles && (
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFiles(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={disabled || uploading}
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled || uploading}
              className="relative pointer-events-none"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  上傳中...
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  選擇圖片
                </>
              )}
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {images.length > 0 ? (
              <span>已上傳 {images.length}/{maxFiles} 張</span>
            ) : (
              <span>請上傳房源照片（最多 {maxFiles} 張）</span>
            )}
          </div>
        </div>
      )}

      {/* 提示文字 */}
      {images.length === 0 && !uploading && (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <Upload className="h-10 w-10 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">
              點擊上方按鈕選擇圖片，或將圖片拖放到此處
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              支援 JPG、PNG 格式，單檔最大 10MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}