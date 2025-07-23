import { useState, useCallback } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
}

export function ImageUpload({ 
  maxFiles = 10, 
  onImagesChange,
  disabled = false,
  getAuthToken
}: ImageUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // 處理檔案選擇
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // 檢查檔案數量
    if (images.length + fileArray.length > maxFiles) {
      toast.error(`最多只能上傳 ${maxFiles} 張圖片`);
      return;
    }

    // 檢查檔案類型和大小
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
      // 優化圖片大小
      const optimizedFiles = await Promise.all(
        validFiles.map(file => optimizeImage(file))
      );
      
      // 準備表單資料
      const formData = new FormData();
      optimizedFiles.forEach(file => {
        formData.append('images', file);
      });

      // 獲取認證 token
      const token = await getAuthToken();
      
      // 上傳到 IPFS
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
      
      // 更新狀態
      const newImages = result.images.map((img: any, index: number) => ({
        ipfsHash: img.ipfsHash,
        gatewayUrl: img.gatewayUrl,
        file: optimizedFiles[index]
      }));

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

  // 優化圖片
  const optimizeImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      // 如果檔案小於 1MB，直接返回
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
          
          // 計算新尺寸（最大 1920px）
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
          
          // 繪製圖片
          ctx.drawImage(img, 0, 0, width, height);
          
          // 轉換為 Blob
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
            0.85 // 85% 品質
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // 處理拖放
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // 移除圖片
  const removeImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChange(newImages.map(img => img.ipfsHash));
  }, [images, onImagesChange]);

  return (
    <div className="space-y-4">
      {/* 上傳區域 */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          dragActive && "border-primary bg-primary/5",
          disabled && "opacity-50 pointer-events-none",
          !dragActive && "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled || uploading}
        />
        
        <div className="space-y-2">
          {uploading ? (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">上傳中...</p>
            </>
          ) : (
            <>
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                拖放圖片到此處，或點擊選擇檔案
              </p>
              <p className="text-sm text-muted-foreground">
                支援 JPG、PNG 格式，單檔最大 10MB
              </p>
              <p className="text-sm text-muted-foreground">
                已上傳 {images.length} / {maxFiles} 張
              </p>
            </>
          )}
        </div>
      </div>

      {/* 圖片預覽 */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div key={image.ipfsHash} className="relative group">
              <img
                src={URL.createObjectURL(image.file)}
                alt={`上傳圖片 ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg"
              />
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(index)}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 rounded-b-lg">
                <p className="truncate">{image.ipfsHash}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}