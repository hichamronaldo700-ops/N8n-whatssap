# WhatsApp AI Service - دليل الإستعمال

هاد الservice كيربط WhatsApp ديالك مع n8n باش تقدر تبني AI Agent كيرد على رسائل automatically.

## كيفاش خدام (Architecture):
```
Client يبعت WhatsApp → هاد الservice → n8n webhook → AI (OpenAI/Gemini) → يرجع response → هاد الservice → WhatsApp
```

## خطوات الديبلوي على Railway:

### 1. رفع الكود لGitHub
```bash
git init
git add .
git commit -m "Initial WhatsApp AI service"
git branch -M main
git remote add origin https://github.com/USERNAME/whatsapp-ai-service.git
git push -u origin main
```

### 2. ديبلوي على Railway
1. دخل لـ [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. اختار الrepo لي رفعتي
4. Railway غادي يكتشف الDockerfile automatically

### 3. زيد Environment Variables ف Railway
دخل ل Settings > Variables وزيد:

| Variable | القيمة |
|---|---|
| `N8N_WEBHOOK_URL` | اللينك ديال webhook ف n8n (غادي تجيه ملي تبني الworkflow) |
| `AUTH_TOKEN` | اختار كلمة سر قوية (مثلا: `aivegita-secret-2026`) |

### 4. سكان QR Code
1. ملي يخدم الdeploy، دخل لـ `https://your-service.up.railway.app/qr`
2. سكان الQR code بWhatsApp ديالك:
   - WhatsApp > الإعدادات > الأجهزة المرتبطة > ربط جهاز
3. بعد السكان، الservice غادي يكون connecté

### 5. تأكد بلي خدام
دخل لـ `https://your-service.up.railway.app/` غادي يوريك:
```json
{"status": "running", "whatsappReady": true}
```

## الEndpoints:

### `GET /qr`
يوريك QR code باش تسكانيه (مرة واحدة فقط، أو ملي ينقطع الاتصال)

### `POST /send`
n8n كيستعملو باش يبعت رسالة عبر WhatsApp.

Headers:
```
x-auth-token: نفس القيمة لي وضعتي ف AUTH_TOKEN
```

Body:
```json
{
  "to": "212600000000@c.us",
  "message": "Salam! Hadi rsala automatique."
}
```

## ⚠️ نقاط مهمة:

1. **Session persistence**: على Railway free tier، إذا الservice "يعاود يبدا" (redeploy)، يقدر يخسر الsession ويطلب سكان QR من جديد. هادشي نورمال ف البداية.

2. **مارسلش بزاف ديال رسائل فوقت قصير**: باش ماتبانش الحساب كautomation ويتبان (banned) من Meta، خاصك:
   - ماتبعتش أكثر من 15-20 رسالة ف الساعة ف البداية
   - زيد delay بين الرسائل (2-5 ثواني)

3. **هاد الmethod غير رسمية (unofficial)**: كتستعمل WhatsApp Web library، ماشي WhatsApp Business API الرسمية. كافية للبداية وللديمو، لكن ملي تكبر وتبدا عندك clients production كثيرين، فكر فWhatsApp Business API الرسمية (Twilio, 360dialog).

## الخطوة الجاية:
بعد ما يخدم هاد الservice، خاصك تبني n8n workflow اللي:
1. يستقبل من webhook (الرسالة الواردة)
2. يبعتها لAI (OpenAI/Gemini) مع prompt مخصص (بحال "أنت assistant ديال real estate agency...")
3. يرجع response عبر `/send` endpoint
