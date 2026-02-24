#!/usr/bin/env python3
"""
Create Admin Account - SmartDesk
Run this script to create an admin account from the command line.
"""

import sqlite3
import getpass
from werkzeug.security import generate_password_hash

DB_PATH = 'nexus.db'

def create_admin():
    print("=" * 50)
    print("SmartDesk - Create Admin Account")
    print("=" * 50)
    print()
    
    name = input("Admin Name: ").strip()
    if not name:
        print("❌ Name is required")
        return
    
    email = input("Admin Email: ").strip().lower()
    if not email:
        print("❌ Email is required")
        return
    
    password = getpass.getpass("Password (min 6 characters): ")
    if len(password) < 6:
        print("❌ Password must be at least 6 characters")
        return
    
    password_confirm = getpass.getpass("Confirm Password: ")
    if password != password_confirm:
        print("❌ Passwords do not match")
        return
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if email already exists
        cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        if cursor.fetchone():
            print(f"❌ Email {email} is already registered")
            conn.close()
            return
        
        # Create admin account
        cursor.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            (name, email, generate_password_hash(password), 'admin')
        )
        conn.commit()
        conn.close()
        
        print()
        print("✅ Admin account created successfully!")
        print()
        print(f"Name:  {name}")
        print(f"Email: {email}")
        print(f"Role:  Admin")
        print()
        print("You can now log in at http://localhost:5000/login")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    create_admin()
