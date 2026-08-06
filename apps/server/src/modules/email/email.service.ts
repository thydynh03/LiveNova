import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly initialized: boolean = false;
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@livenova.app';

    if (apiKey && apiKey.startsWith('SG.')) {
      sgMail.setApiKey(apiKey);
      this.initialized = true;
      this.logger.log('SendGrid EmailService initialized with API key');
    } else {
      this.logger.warn('SENDGRID_API_KEY not configured or invalid. EmailService will log OTP to console in DEV mode.');
    }
  }

  async sendOtp(to: string, code: string, type: 'REGISTER' | 'FORGOT_PASSWORD'): Promise<boolean> {
    const subject = type === 'REGISTER'
      ? 'LiveNova - Mã xác thực đăng ký tài khoản (OTP)'
      : 'LiveNova - Mã xác thực khôi phục mật khẩu (OTP)';

    const actionText = type === 'REGISTER' ? 'xác thực tài khoản mới' : 'đặt lại mật khẩu';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #6366f1; text-align: center;">LiveNova</h2>
        <p>Xin chào,</p>
        <p>Mã OTP của bạn để <strong>${actionText}</strong> trên LiveNova là:</p>
        <div style="background: #f4f4f5; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #18181b;">${code}</span>
        </div>
        <p style="font-size: 13px; color: #71717a;">Mã OTP có hiệu lực trong <strong>10 phút</strong>. Vui lòng không chia sẻ mã này cho ai khác.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #a1a1aa; text-align: center;">Đây là email tự động, vui lòng không trả lời email này.</p>
      </div>
    `;

    // Always log OTP to console in dev mode so developer can test easily
    this.logger.log(`[OTP VERIFICATION] Type=${type} | Email=${to} | OTP Code=${code}`);

    if (!this.initialized) {
      return true; // Return success so flow proceeds in dev without API key
    }

    try {
      await sgMail.send({
        to,
        from: this.fromEmail,
        subject,
        html,
      });
      this.logger.log(`OTP email sent successfully via SendGrid to ${to}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send OTP email to ${to}: ${err?.message ?? err}`);
      return false;
    }
  }
}
