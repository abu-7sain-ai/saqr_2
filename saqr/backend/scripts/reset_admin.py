import asyncio
import httpx
import os
from backend.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, get_supabase_admin_client

async def reset_admin_password():
    """
    إعادة تعيين كلمة المرور وتفعيل حساب الأدمن عبر Supabase Admin API.
    """
    admin_email = "admin@saqr.com"
    new_password = "Admin#Saqr2026"
    
    print(f"Attempting to reset credentials for: {admin_email}")
    
    # 1. جلب الـ User ID من Auth
    supabase = get_supabase_admin_client()
    
    # تحذير: الـ Admin SDK في supabase-py يتطلب التعامل مع httpx مباشرة أو استخدام مكتبات معينة
    # سنستخدم httpx مباشرة للوصول لـ Auth Admin API
    auth_url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        # جلب قائمة المستخدمين للبحث عن الإيميل
        resp = await client.get(auth_url, headers=headers)
        if resp.status_code != 200:
            print(f"Error fetching users: {resp.text}")
            return
            
        users = resp.json()
        target_user = next((u for u in users if u['email'] == admin_email), None)
        
        if not target_user:
            print(f"User {admin_email} not found. Creating new admin user...")
            # إنشاء أدمن جديد إذا لم يكن موجوداً
            create_resp = await client.post(auth_url, headers=headers, json={
                "email": admin_email,
                "password": new_password,
                "email_confirm": True,
                "user_metadata": {"role": "admin"}
            })
            if create_resp.status_code not in [200, 201]:
                print(f"Failed to create user: {create_resp.text}")
                return
            user_id = create_resp.json()['id']
            print("New Admin user created successfully.")
        else:
            user_id = target_user['id']
            # تحديث كلمة المرور
            update_resp = await client.put(f"{auth_url}/{user_id}", headers=headers, json={
                "password": new_password,
                "email_confirm": True
            })
            if update_resp.status_code != 200:
                print(f"Failed to update password: {update_resp.text}")
                return
            print("Password updated successfully.")
            
        # 2. ضمان وجود وتفعيل البروفايل في جدول profiles
        profile_data = {
            "id": user_id,
            "email": admin_email,
            "name": "الصقر (Admin)",
            "role": "admin",
            "status": "active"
        }
        
        # استخدام upsert لضمان التحديث أو الإدخال
        try:
            # supabase-py doesn't have a clean upsert via REST sometimes, so delete and insert logic or RPC
            supabase.table('profiles').upsert(profile_data, on_conflict='id').execute()
            print("Profile successfully synced and set to ACTIVE.")
        except Exception as e:
            # Fallback if upsert fails
            supabase.table('profiles').insert(profile_data).execute()
            print("Profile manually inserted.")

    print("\n" + "="*40)
    print("SUCCESS: You can now log in with:")
    print(f"Email: {admin_email}")
    print(f"Password: {new_password}")
    print("="*40)

if __name__ == "__main__":
    asyncio.run(reset_admin_password())
