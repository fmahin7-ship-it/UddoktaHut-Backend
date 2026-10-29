import bcrypt from "bcrypt";

type OtpRecord = {
  otp: number;
  expiresAt: number;
  name: string;
  password: string;
};

function generateOtp(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

const otpMap = new Map<string, OtpRecord>();

function saveOtp(
  {
    identifier,
    name,
    password,
  }: { identifier: string; name: string; password: string },
  otp: number,
  ttl = 60 * 1000
): void {
  if (otpMap.has(identifier)) otpMap.delete(identifier);
  otpMap.set(identifier, {
    otp,
    expiresAt: Date.now() + ttl,
    name,
    password,
  });
}

function verifyOtp(identifier: string, inputOtp: number): OtpRecord | null {
  const record = otpMap.get(identifier);
  if (!record) return null;

  const isValid = record.otp === inputOtp;
  const isExpire = Date.now() > record.expiresAt;

  if (isExpire || !isValid) return null;

  otpMap.delete(identifier);
  return record;
}

async function passwordHashing(
  password: string
): Promise<{ hashedPassword: string }> {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  return { hashedPassword };
}

export { generateOtp, saveOtp, verifyOtp, passwordHashing };
