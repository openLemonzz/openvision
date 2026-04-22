# Supabase Email Templates (Dashboard → Authentication → Email Templates)

## 1. Confirm signup

Subject: `【VISION · 影境】请确认你的邮箱`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;">
          <tr>
            <td style="padding:40px 32px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:10px;color:#666;letter-spacing:0.3em;text-transform:uppercase;">VISION · 影境</p>
              <h1 style="margin:0;font-size:22px;font-weight:400;color:#fff;letter-spacing:0.05em;">邮箱确认</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#aaa;line-height:1.7;">
                你好，<br><br>
                感谢你注册 <strong style="color:#fff;">VISION · 影境</strong>。请点击下方按钮确认你的邮箱地址，完成账户验证。
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 40px;background:#fff;color:#000;font-size:13px;font-weight:500;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;">确认邮箱</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 8px;font-size:12px;color:#555;line-height:1.6;">
                如果按钮无法点击，请复制以下链接到浏览器打开：
              </p>
              <p style="margin:0;font-size:11px;color:#444;font-family:monospace;word-break:break-all;background:#1a1a1a;padding:12px;border:1px solid #222;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #1a1a1a;">
              <p style="margin:0;font-size:11px;color:#444;line-height:1.6;text-align:center;">
                此邮件由 VISION · 影境 自动发送<br>
                如非本人操作，请忽略此邮件
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## 2. Magic Link

Subject: `【VISION · 影境】登录链接`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:48px 20px;">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;">
        <tr><td style="padding:40px 32px 24px;text-align:center;">
          <p style="margin:0 0 8px;font-size:10px;color:#666;letter-spacing:0.3em;text-transform:uppercase;">VISION · 影境</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#fff;letter-spacing:0.05em;">一键登录</h1>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 16px;font-size:14px;color:#aaa;line-height:1.7;">点击下方按钮即可登录你的 VISION · 影境 账户，无需输入密码。</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 40px;background:#fff;color:#000;font-size:13px;font-weight:500;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;">立即登录</a>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <p style="margin:0 0 8px;font-size:12px;color:#555;">或复制链接：</p>
          <p style="margin:0;font-size:11px;color:#444;font-family:monospace;word-break:break-all;background:#1a1a1a;padding:12px;border:1px solid #222;">{{ .ConfirmationURL }}</p>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #1a1a1a;">
          <p style="margin:0;font-size:11px;color:#444;text-align:center;">此链接将在 1 小时后失效</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

## 3. Change Email Address

Subject: `【VISION · 影境】确认新邮箱地址`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:48px 20px;">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;">
        <tr><td style="padding:40px 32px 24px;text-align:center;">
          <p style="margin:0 0 8px;font-size:10px;color:#666;letter-spacing:0.3em;text-transform:uppercase;">VISION · 影境</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#fff;letter-spacing:0.05em;">确认新邮箱</h1>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 16px;font-size:14px;color:#aaa;line-height:1.7;">你请求将账户邮箱更改为 <strong style="color:#fff;">{{ .Email }}</strong>。点击下方按钮完成验证。</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 40px;background:#fff;color:#000;font-size:13px;font-weight:500;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;">确认新邮箱</a>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #1a1a1a;">
          <p style="margin:0;font-size:11px;color:#444;text-align:center;">如非本人操作，请忽略此邮件</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

## 4. Reset Password

Subject: `【VISION · 影境】重置密码`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:48px 20px;">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;">
        <tr><td style="padding:40px 32px 24px;text-align:center;">
          <p style="margin:0 0 8px;font-size:10px;color:#666;letter-spacing:0.3em;text-transform:uppercase;">VISION · 影境</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#fff;letter-spacing:0.05em;">重置密码</h1>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 16px;font-size:14px;color:#aaa;line-height:1.7;">我们收到了你的密码重置请求。点击下方按钮设置新密码。</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 40px;background:#fff;color:#000;font-size:13px;font-weight:500;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;">重置密码</a>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #1a1a1a;">
          <p style="margin:0;font-size:11px;color:#444;text-align:center;">如非本人操作，请忽略此邮件。此链接将在 1 小时后失效。</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
