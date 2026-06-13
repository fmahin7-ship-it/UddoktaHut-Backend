const roles = {
  admin: "admin",
  employee: "employee",
};
const allowedContexts = [
  // Store related - English
  "store",
  "shop",
  "business",
  "company",
  "enterprise",
  // Store related - Bengali
  "দোকান",
  "ব্যবসা",
  "স্টোর",
  // Store related - Hindi
  "स्टोर",
  "दुकान",
  "व्यापार",
  "व्यवसाय",
  "कंपनी",
  // Store related - Urdu
  "دکان",
  "کاروبار",
  "اسٹور",
  // Store related - Arabic
  "متجر",
  "محل",
  "أعمال",

  // Product related - English
  "product",
  "item",
  "inventory",
  "stock",
  "goods",
  "merchandise",
  // Product related - Bengali
  "পণ্য",
  "স্টক",
  "পণ্যসামগ্রী",
  // Product related - Hindi
  "उत्पाद",
  "सामान",
  "वस्तु",
  "स्टॉक",
  "माल",
  // Product related - Urdu
  "پیداوار",
  "سامان",
  "اسٹاک",

  // Owner/user related - English
  "owner",
  "user",
  "account",
  "profile",
  "customer",
  // Owner/user related - Bengali
  "মালিক",
  "অ্যাকাউন্ট",
  "ব্যবহারকারী",
  // Owner/user related - Hindi
  "मालिक",
  "उपयोगकर्ता",
  "खाता",
  "ग्राहक",
  // Owner/user related - Urdu
  "مالک",
  "صارف",
  "اکاؤنٹ",

  // Analysis related - English
  "info",
  "information",
  "data",
  "analysis",
  "report",
  "details",
  "status",
  "sales",
  "revenue",
  "profit",
  "trend",
  "trends",
  "performance",
  "analytics",
  "sell",
  // Analysis related - Bengali
  "তথ্য",
  "বিশ্লেষণ",
  "বিবরণ",
  "অবস্থা",
  // Analysis related - Hindi
  "जानकारी",
  "विवरण",
  "विश्लेषण",
  "रिपोर्ट",
  "डेटा",
  "स्थिति",
  // Analysis related - Urdu
  "معلومات",
  "تفصیلات",
  "تجزیہ",

  // Platform specific
  "uddoktaHut",
  "উদ্যোক্তাহাট",
  "order",
  "অর্ডার",
  "ऑर्डर",

  // Question words - Hindi
  "क्या",
  "कैसा",
  "कैसे",
  "कहाँ",
  "कब",
  "क्यों",
  "कौन",
  "कितना",
  // Question words - Bengali
  "কী",
  "কেমন",
  "কীভাবে",
  "কোথায়",
  "কখন",
  "কেন",
  "কে",
  "কত",
  // Question words - Urdu
  "کیا",
  "کیسا",
  "کیسے",
  "کہاں",
  "کب",
  "کیوں",
  "کون",
  "کتنا",
];

const blockedContexts = [
  // Dangerous operations - English
  "delete",
  "update",
  "create",
  "insert",
  "drop",
  "alter",
  "truncate",
  "modify",
  // Dangerous operations - Bengali
  "মুছে",
  "আপডেট",
  "তৈরি",
  "পরিবর্তন",
  // Dangerous operations - Hindi
  "मिटाना",
  "हटाना",
  "अपडेट",
  "बनाना",
  "बदलना",
  "डालना",
  // Dangerous operations - Urdu
  "ڈیلیٹ",
  "اپڈیٹ",
  "بنانا",
  "تبدیل",

  // Security sensitive - English
  "password",
  "token",
  "secret",
  "key",
  "admin",
  "root",
  "auth",
  // Security sensitive - Bengali
  "পাসওয়ার্ড",
  "গোপনীয়",
  "চাবি",
  // Security sensitive - Hindi
  "पासवर्ड",
  "गुप्त",
  "चाबी",
  "एडमिन",
  // Security sensitive - Urdu
  "پاسورڈ",
  "خفیہ",
  "چابی",

  // Cross-store access - English
  "other store",
  "other stores",
  "another store",
  "another stores",
  "all stores",
  "every store",
  "different store",
  "competitor store",

  // System operations
  "system",
  "database",
  "table",
  "schema",
  "file",
  "directory",
  "all",
  "everything",
  "complete",
  "entire",
  "full",
];

// Basic forbidden operations
const forbidden = ["DELETE", "UPDATE", "INSERT", "DROP", "ALTER", "TRUNCATE"];
export { roles, allowedContexts, blockedContexts, forbidden };
