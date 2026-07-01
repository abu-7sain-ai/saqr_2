import asyncio
import httpx
from backend.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, get_supabase_admin_client

async def reset_admin_by_id():
    admin_email = "admin@saqr.com"
    new_password = "Admin#Saqr2026"
    
    supabase = get_supabase_admin_client()
    
    # 1. جلب الـ ID
    resp = supabase.table('profiles').select('id').eq('email', admin_email).execute()
    if not resp.data:
        print(f"Could not find profile for {admin_email}")
        return
        
    user_id = resp.data[0]['id']
    print(f"Found User ID: {user_id}")
    
    # 2. التحديث المباشر عبر Auth Admin API
    auth_url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        update_resp = await client.put(auth_url, headers=headers, json={
            "password": new_password,
            "email_confirm": True
        })
        
        if update_resp.status_code == 200:
            print("\n" + "="*40)
            print("SUCCESS: Credentials Reset Successfully!")
            print(f"Email: {admin_email}")
            print(f"Password: {new_password}")
            print("="*40)
            
            # 3. التأكد من حالة البروفايل
            supabase.table('profiles').update({"status": "active"}).eq('id', user_id).execute()
            print("Profile set to ACTIVE.")
        else:
            print(f"Failed to reset: {update_resp.text}")

if __name__ == "__main__":
    asyncio.run(reset_admin_by_id())
