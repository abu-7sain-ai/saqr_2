import datetime
from database import Database

class AdvancedModel:
    def __init__(self, user_id=None):
        self.user_id = user_id
        self.lstm_model = "LSTM_KERAS_ACTIVE"
        self.training_data = []

    def reset_training(self):
        """
        يمسح ذاكرة LSTM فقط ويبدأ من الصفر.
        الصفقات المسجلة في Supabase لن تتأثر.
        """
        try:
            # يمسح ذاكرة LSTM فقط
            self.lstm_model = None
            self.training_data = []
            
            # تسجيل وقت التصفير
            self.save_reset_log()
            
            print(f"✅ [AdvancedModel] LSTM Training Reset triggered.")
            return True
        except Exception as e:
            print(f"❌ [AdvancedModel] Error resetting training: {e}")
            return False

    def save_reset_log(self):
        """يسجل وقت التصفير في سجل النظام."""
        if self.user_id:
            try:
                from database import Database
                import datetime
                Database.log_activity(
                    user_id=self.user_id,
                    log_type="model_reset",
                    message="تم تصفير بيانات تدريب المطور (LSTM Memory Reset) بنجاح.",
                    metadata={"timestamp": datetime.datetime.now().isoformat()}
                )
            except Exception as e:
                print(f"Log error: {e}")
