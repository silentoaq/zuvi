import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details
    });
    return;
  }

  if (err.message.includes('E001')) {
    res.status(400).json({ error: '系統尚未初始化' });
    return;
  }
  if (err.message.includes('E002')) {
    res.status(403).json({ error: '無權限執行此操作' });
    return;
  }
  if (err.message.includes('E003')) {
    res.status(400).json({ error: '房源已出租' });
    return;
  }
  if (err.message.includes('E004')) {
    res.status(404).json({ error: '申請不存在或狀態不正確' });
    return;
  }
  if (err.message.includes('E005')) {
    res.status(400).json({ error: '租約未生效' });
    return;
  }
  if (err.message.includes('E006')) {
    res.status(400).json({ error: '尚未簽署' });
    return;
  }
  if (err.message.includes('E007')) {
    res.status(400).json({ error: '已經簽署' });
    return;
  }
  if (err.message.includes('E008')) {
    res.status(400).json({ error: '爭議進行中，無法執行' });
    return;
  }
  if (err.message.includes('E009')) {
    res.status(400).json({ error: '無效的參數' });
    return;
  }
  if (err.message.includes('E010')) {
    res.status(403).json({ error: '需要 API 簽名' });
    return;
  }
  if (err.message.includes('E011')) {
    res.status(400).json({ error: '房源已下架' });
    return;
  }
  if (err.message.includes('E012')) {
    res.status(400).json({ error: '重複申請' });
    return;
  }
  if (err.message.includes('E013')) {
    res.status(400).json({ error: '租約已存在' });
    return;
  }
  if (err.message.includes('E014')) {
    res.status(400).json({ error: '支付日尚未到期' });
    return;
  }
  if (err.message.includes('E015')) {
    res.status(400).json({ error: '租約已結束' });
    return;
  }
  if (err.message.includes('E016')) {
    res.status(400).json({ error: '金額不匹配' });
    return;
  }
  if (err.message.includes('E017')) {
    res.status(400).json({ error: '爭議已解決' });
    return;
  }
  if (err.message.includes('E018')) {
    res.status(403).json({ error: '非仲裁者' });
    return;
  }
  if (err.message.includes('E019')) {
    res.status(400).json({ error: '押金已釋放' });
    return;
  }
  if (err.message.includes('E020')) {
    res.status(400).json({ error: '無效的日期' });
    return;
  }
  if (err.message.includes('E021')) {
    res.status(400).json({ error: '無效的費率' });
    return;
  }
  if (err.message.includes('E022')) {
    res.status(400).json({ error: '無效的押金金額' });
    return;
  }
  if (err.message.includes('E023')) {
    res.status(400).json({ error: '無效的支付日' });
    return;
  }
  if (err.message.includes('E024')) {
    res.status(400).json({ error: '無效的爭議原因' });
    return;
  }
  if (err.message.includes('E025')) {
    res.status(400).json({ error: '無法對自己的房源申請' });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};