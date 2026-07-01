class ExpertTypes:
    # كل الخبراء الثمانية
    REACTIVE = "reactive"           # تحليلي: يشوف البيانات الحالية ويرد فوراً
    CASE_BASED = "case_based"       # عرّافي: يقارن الوضع الحالي بـ 10 سنوات من التاريخ
    
    # العادي (الأمير) فقط
    PREDICTIVE_PARTIAL = "predictive_partial"  # تنبؤي جزئي: يعطي احتمالية مستقبلية بدقة رقمية
    UTILITY = "utility_based"                  # حسابي: يحسب ربح/مخاطرة رياضياً ويختار الأفضل
    
    # المطور (King) فقط
    PREDICTIVE_FULL = "predictive_full"  # تنبؤي كامل
    LEARNING = "learning_agent"          # عقل التعلم: يتحسن مع كل صفقة جديدة
    LSTM = "lstm_keras"                  # LSTM via Keras: يتعلم من صفقاتنا الحقيقية تحديداً

    # المطبخ كاملاً
    MULTI_AGENT = "multi_agent"     # متعدد العقول: مجموعة عقول تتناقش وتتفق على قرار
