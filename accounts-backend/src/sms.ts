const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

export async function sendSms(mobile: string, code: string): Promise<{ real: boolean }> {
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
    try {
      const twilioModule: any = await import("twilio");
      const client = twilioModule.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `Your Vinaru verification code is ${code}`,
        from: TWILIO_FROM_NUMBER,
        to: mobile,
      });
      return { real: true };
    } catch (err: any) {
      console.error("[sms] Twilio send failed, falling back to dev console code:", err.message);
    }
  }

  console.log(`[dev-otp] Vinaru verification code for ${mobile}: ${code}`);
  return { real: false };
}
