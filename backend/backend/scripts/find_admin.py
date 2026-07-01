import asyncio
from backend.config import get_supabase_admin_client

async def find_admin():
    supabase = get_supabase_admin_client()
    try:
        resp = supabase.table('profiles').select('email, role').eq('role', 'admin').execute()
        if resp.data:
            print("\nAdmin User Found:")
            for user in resp.data:
                print(f"Email: {user['email']}")
        else:
            print("\nNo admin user found in profiles table.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(find_admin())
