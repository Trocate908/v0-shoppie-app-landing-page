# Python script to generate 500 unique 17-digit verification keys
# Run this script to generate keys: python scripts/generate_keys.py

import random
import string

def generate_key():
    """Generate a random 17-character key using uppercase letters and digits, excluding similar-looking characters"""
    # Exclude 0, O, 1, I, L to avoid confusion
    chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return ''.join(random.choice(chars) for _ in range(17))

def generate_unique_keys(count=500):
    """Generate unique keys and ensure no duplicates"""
    keys = set()
    while len(keys) < count:
        keys.add(generate_key())
    return sorted(keys)

if __name__ == "__main__":
    keys = generate_unique_keys(500)
    
    # Print to console
    print("# ShoppieApp Verification Keys")
    print(f"# Generated {len(keys)} unique 17-digit activation keys\n")
    for key in keys:
        print(key)
    
    # Save to file
    with open('verification-keys.txt', 'w') as f:
        f.write("# ShoppieApp Verification Keys\n")
        f.write(f"# Generated {len(keys)} unique 17-digit activation keys\n\n")
        for key in keys:
            f.write(f"{key}\n")
    
    print(f"\n✓ Keys saved to verification-keys.txt")
