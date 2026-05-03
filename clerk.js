import * as SecureStore from 'expo-secure-store';

export const tokenCache = {
  async getToken(key) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

export const CLERK_PUBLISHABLE_KEY = "pk_test_Y29uY2lzZS1tYWxhbXV0ZS01Ny5jbGVyay5hY2NvdW50cy5kZXYk";