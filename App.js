import { ClerkProvider, SignedIn, SignedOut, useSignIn, useUser, useClerk } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Linking, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase'; // make sure this exists
import { decode } from 'base64-arraybuffer';

const tokenCache = {
  async getToken(key) {
    try { return SecureStore.getItemAsync(key); }
    catch (err) { return null; }
  },
  async saveToken(key, value) {
    try { return SecureStore.setItemAsync(key, value); }
    catch (err) { return; }
  },
};

const openWhatsApp = (type) => {
  const phoneNumber = "+971521859433";
  let message = type === 'reports'
    ? "Hi Prime Book Accounting, I would like to request a copy of my latest Financial Reports."
    : "Hello Prime Book Accounting, I have a general inquiry about my Accounting Status.";
  const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() => Alert.alert("Error", "Please ensure WhatsApp is installed."));
};

function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);

  const onSignInPress = async () => {
    if (!isLoaded) return;
    try {
      await signIn.create({ identifier: emailAddress, strategy: "email_code" });
      setPendingVerification(true);
      Alert.alert("Success", "Check your E-mail for the 6-digit verification code.");
    } catch (err) {
      Alert.alert("Error: The E-mail", err.errors[0].message);
    }
  };

  const onVerifyPress = async () => {
    if (!isLoaded) return;
    try {
      const result = await signIn.attemptFirstFactor({ strategy: "email_code", code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
      }
    } catch (err) {
      Alert.alert("Verification Failed", err.errors[0].message);
    }
  };

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>PRIME BOOK</Text>
        <Text style={styles.footertext}>Accounting & Bookkeeping</Text>
        <Text style={styles.nanosubtitle}>ACCURACY. COMPLIANCE. GROWTH</Text>
      </View>
      <View style={styles.form}>
        {!pendingVerification ? (
          <>
            <Text style={styles.label}>Client Email</Text>
            <TextInput
              autoCapitalize="none"
              style={styles.input}
              placeholder="Example: client.tax@company.com"
              value={emailAddress}
              onChangeText={setEmailAddress}
            />
            <TouchableOpacity style={styles.button} onPress={onSignInPress}>
              <Text style={styles.buttonText}>Get Your Access Code</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter 6-Digit Code</Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: '#b89733' }]} onPress={onVerifyPress}>
              <Text style={styles.buttonText}>Verify & Enter Portal</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPendingVerification(false)}>
              <Text style={{ textAlign: 'center', marginTop: 15, color: '#666' }}>Back to E-mail</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
     <View style={styles.footerContainer}>
  <Text style={styles.footerText}>🔒 Authorized Access Only</Text>
  <Text style={styles.footerSub}>Prime Book Accounting • Dubai, UAE 🇦🇪</Text>
</View>
    </View>
  );
}

// ✅ Single Dashboard component with uploadDocument INSIDE so it can access 'user'
function Dashboard() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const handleLogout = async () => {
    try {
      // This will clear the session and trigger the <SignedOut> view in App.js
      await signOut(); 
    } catch (err) {
      console.error("Logout Error:", err);
      Alert.alert("Error", "Logout failed. Please try again.");
    }
  };
  const [uploading, setUploading] = useState(false);
const [documents, setDocuments] = useState([]);
const [loadingFiles, setLoadingFiles] = useState(false);
  // 1. ADDED: The missing Fetch function
  const fetchDocuments = async () => {
    if (!user) return;
    setLoadingFiles(true);
    try {
      const clientEmail = user.primaryEmailAddress.emailAddress;
      const folderPath = `uploads/${clientEmail}/`;

      const { data, error } = await supabase.storage
        .from('client-documents')
        .list(folderPath, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  // 2. The Trigger
  React.useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

const uploadDocument = async () => {
  try {
    if (!user) {
      Alert.alert("Error", "User session not found. Please log in again.");
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    setUploading(true);
    const clientEmail = user.primaryEmailAddress.emailAddress;
    let successCount = 0;
    let failCount = 0;

    for (const file of result.assets) {
      try {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const arrayBuffer = decode(base64);
        const cleanFileName = file.name.replace(/\s+/g, '_');
        const ext = cleanFileName.includes('.') ? cleanFileName.split('.').pop() : '';
        const nameWithoutExt = ext ? cleanFileName.slice(0, -(ext.length + 1)) : cleanFileName;
        const filePath = `uploads/${clientEmail}/${nameWithoutExt}_${Date.now()}.${ext}`;

        const { error } = await supabase.storage
          .from('client-documents')
          .upload(filePath, arrayBuffer, {
            contentType: file.mimeType || 'application/octet-stream',
            upsert: true,
          });

        if (error) throw error;
        successCount++;

      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        failCount++;
      }
    }

    if (failCount === 0) {
      Alert.alert("Success", `${successCount} file(s) uploaded successfully!`);
    } else {
      Alert.alert("Partial Upload", `${successCount} uploaded, ${failCount} failed.`);
    }
    // ✅ ADD THIS LINE HERE to refresh the list automatically
    await fetchDocuments();

  } catch (err) {
    console.error("Upload error:", err);
    Alert.alert("Upload Failed", err.message || "Please try again.");
  } finally {
    setUploading(false);
    fetchDocuments();
  }
};

const viewDocument = async (fileName) => {
    try {
      const clientEmail = user.primaryEmailAddress.emailAddress;
      const filePath = `uploads/${clientEmail}/${fileName}`;
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(filePath, 300);

      if (error) throw error;
      await Linking.openURL(data.signedUrl);
    } catch (err) {
      Alert.alert("Error", "Could not open document.");
    }
  };
const deleteDocument = async (fileName) => {
  Alert.alert(
    "Delete Document",
    "Are you sure you want to remove this file?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const clientEmail = user.primaryEmailAddress.emailAddress;
            const filePath = `uploads/${clientEmail}/${fileName}`;

            const { error } = await supabase.storage
              .from('client-documents')
              .remove([filePath]);

            if (error) throw error;

            Alert.alert("Deleted", "File removed successfully.");
            fetchDocuments(); // Refresh the list
          } catch (err) {
            Alert.alert("Error", "Delete failed. Please contact Prime Book support.");
          }
        },
      },
    ]
  );
};

// Inside Dashboard function
const [selectedFiles, setSelectedFiles] = useState([]);
const [isSelectMode, setIsSelectMode] = useState(false);

const toggleSelect = (fileName) => {
  if (selectedFiles.includes(fileName)) {
    setSelectedFiles(prev => prev.filter(item => item !== fileName));
  } else {
    setSelectedFiles(prev => [...prev, fileName]);
  }
};

const deleteSelected = async () => {
  if (selectedFiles.length === 0) return;

  Alert.alert(
    "Bulk Delete", 
    `Are you sure you want to delete ${selectedFiles.length} documents?`, 
    [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete All", 
        style: "destructive", 
        onPress: async () => {
          try {
            const clientEmail = user.primaryEmailAddress.emailAddress;
            const paths = selectedFiles.map(name => `uploads/${clientEmail}/${name}`);
            
            const { error } = await supabase.storage.from('client-documents').remove(paths);
            
            if (error) throw error;

            Alert.alert("Success", "Storage Updated.");
            setSelectedFiles([]);
            setIsSelectMode(false);
            // This ensures the "Recent Submissions" section disappears if empty
            await fetchDocuments(); 
          } catch (err) {
            Alert.alert("Error", "Could not complete bulk delete.");
          }
        }
      }
    ]
  );
};
 
const selectAllFiles = () => {
  // Filter for valid files first to match what's on screen
  const validFiles = documents
    .filter(doc => doc.metadata && doc.metadata.size > 0)
    .map(doc => doc.name);

  if (selectedFiles.length === validFiles.length) {
    // If everything is already selected, unselect all
    setSelectedFiles([]);
  } else {
    // Otherwise, select everything
    setSelectedFiles(validFiles);
  }
};

const [refreshing, setRefreshing] = useState(false);
const onRefresh = React.useCallback(async () => {
  setRefreshing(true);
  await fetchDocuments();
  setRefreshing(false);
}, [user]);

  return (
    <SafeAreaView style={styles.container}>
    <ScrollView 
      contentContainerStyle={{ flexGrow: 1 }} 
      showsVerticalScrollIndicator={false}
      refreshControl={
    <RefreshControl 
      refreshing={refreshing} 
      onRefresh={onRefresh} 
      colors={['#b89733']} // Prime Book Gold
      tintColor={'#b89733'} // For iOS
    />
  }
  
    ><TouchableOpacity 
  style={{ marginTop: 30, padding: 15, alignItems: 'flex-end' }} 
  onPress={handleLogout}
>
  <Text style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: 13 }}>
    Secure Logout
  </Text>
</TouchableOpacity>
    <View style={styles.content}>
      <View style={styles.dashboardHeader}>
        <Text style={styles.welcomeText}>Welcome Back,</Text>
        <Text style={styles.title}>PRIME BOOK ACCOUNTING</Text>
        <Text style={styles.nanosubtitle}>ACCURACY. COMPLIANCE. GROWTH</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>Compliance Status</Text>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>VAT Filing (Q1)</Text>
            <Text style={{ color: '#fff', fontSize: 10 }}>Due: May 28, 2026</Text>
          </View>
          <Text style={[styles.statusValue, { color: '#2ecc71' }]}>● FILED</Text>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 10 }} />
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>Corporate Tax</Text>
            <Text style={{ color: '#fff', fontSize: 10 }}>Filing Deadline: 30 September 2026</Text>
          </View>
          <Text style={[styles.statusValue, { color: '#f1c40f' }]}>● PENDING</Text>
        </View>
      </View>

      <View style={styles.menuGrid}>
        <TouchableOpacity style={styles.menuItem} onPress={uploadDocument} disabled={uploading}>
          <Text style={styles.menuIcon}>📁</Text>
          <Text style={styles.menuText}>{uploading ? 'Uploading...' : 'Upload Documents'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => openWhatsApp('reports')}>
          <Text style={styles.menuIcon}>📊</Text>
          <Text style={styles.menuText}>Reports</Text>
        </TouchableOpacity>
      </View>

    {/* Only show the header and list if there are valid files > 0kb */}
{documents.filter(doc => doc.metadata && doc.metadata.size > 0).length > 0 && (
  <View style={{ marginTop: 20 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1a2b48' }}>
        Recent Submissions
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {isSelectMode ? (
      <>
        <TouchableOpacity onPress={selectAllFiles} style={{ marginRight: 15 }}>
          <Text style={{ color: '#b89733', fontWeight: 'bold', fontSize: 12 }}>
            {selectedFiles.length === documents.filter(d => d.metadata?.size > 0).length ? "Unselect All" : "Select All"}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={deleteSelected}>
          <Text style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: 12 }}>
            Delete ({selectedFiles.length})
          </Text>
        </TouchableOpacity>
      </>
    ) : (
      <TouchableOpacity onPress={() => setIsSelectMode(true)}>
        <Text style={{ color: '#b89733', fontWeight: 'bold' }}>Select</Text>
      </TouchableOpacity>
    )}
  </View>
</View>

    {documents
      .filter(doc => doc.metadata && doc.metadata.size > 0)
      .map((doc, index) => {
        const isSelected = selectedFiles.includes(doc.name);
        return (
          <TouchableOpacity 
            key={index} 
            style={[styles.documentRow, isSelected && { borderColor: '#b89733', backgroundColor: '#fffdf5' }]}
            onPress={() => isSelectMode ? toggleSelect(doc.name) : viewDocument(doc.name)} 
            onLongPress={() => {
              if (!isSelectMode) {
                setIsSelectMode(true);
                toggleSelect(doc.name);
              }
            }}
          >
            <Text style={styles.documentIcon}>{isSelectMode ? (isSelected ? "✅" : "⭕") : "📄"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.documentName} numberOfLines={1}>
                {doc.name.includes('_') ? doc.name.split('_').slice(1).join('_') : doc.name} 
              </Text>
              <Text style={styles.documentDate}>
                {new Date(doc.created_at).toLocaleDateString()}
              </Text>
            </View>
            {!isSelectMode && <Text style={{ color: '#2ecc71', fontSize: 10, fontWeight: 'bold' }}>VIEW</Text>}
          </TouchableOpacity>
        );
      })}
      
    {isSelectMode && (
      <TouchableOpacity onPress={() => { setIsSelectMode(false); setSelectedFiles([]); }}>
        <Text style={{ textAlign: 'center', color: '#666', marginTop: 5 }}>Cancel Selection</Text>
      </TouchableOpacity>
    )}
  </View>
)}

      <TouchableOpacity style={styles.supportButton} onPress={() => openWhatsApp('general')}>
        <Text style={styles.supportButtonText}>Connect Advisor</Text>
      </TouchableOpacity>
    </View>
    </ScrollView>
  </SafeAreaView>
  );
// This MUST be inside the Dashboard function
React.useEffect(() => {
  if (user) {
    fetchDocuments();
  }
}, [user]);
 

}

// ✅ Only ONE export default
export default function App() {
  const publishableKey = "pk_test_Y29uY2lzZS1tYWxhbXV0ZS01Ny5jbGVyay5hY2NvdW50cy5kZXYk";

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <SafeAreaView style={styles.container}>
        <SignedIn>
          <Dashboard />
        </SignedIn>
        <SignedOut>
          <SignInScreen />
        </SignedOut>
      </SafeAreaView>
    </ClerkProvider>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 25, justifyContent: 'center', backgroundColor: '#ffffff', paddingBottom: 40 },
  dashboardHeader: { marginBottom: 25, marginTop: 40 },
  welcomeText: { fontSize: 13, color: '#676464', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '900', color: '#122445', letterSpacing: 1 },
  subtitle: { fontSize: 11, color: '#b89733', fontWeight: '700', marginTop: 2 },
  nanosubtitle: { fontSize: 9, color: '#b89733', fontWeight: '700', marginTop: 2 },
  statusCard: {
    backgroundColor: '#1a2b48', padding: 20, borderRadius: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 5, elevation: 8,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  statusValue: { fontWeight: 'bold', fontSize: 13 },
  menuGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  menuItem: {
    backgroundColor: '#f8f9fa', width: '48%', paddingVertical: 25,
    borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#eee',
  },
  menuIcon: { fontSize: 30, marginBottom: 10 },
  menuText: { fontWeight: '700', color: '#1a2b48', fontSize: 12 },
  supportButton: {
    backgroundColor: '#25D366', padding: 16, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10
  },
  supportButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 17, marginLeft: 10 },
  form: { width: '100%' },
  label: { color: '#1a2b48', fontWeight: '700', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#ddd', padding: 15,
    borderRadius: 10, marginBottom: 15, backgroundColor: '#fafafa'
  },
  button: { backgroundColor: '#1a2b48', padding: 18, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  footer: { textAlign: 'center', color: '#bbb', fontSize: 10, marginTop: 30 },
  header: { marginBottom: 30 },

  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  documentIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a2b48',
  },
  documentDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  footerContainer: {
  alignItems: 'center',
  marginTop: 30,
},
footerText: {
  color: '#fa0000',
  fontSize: 13,
  fontWeight: '700',
  letterSpacing: 0.3,
},
footerSub: {
  color: '#c19e14',
  fontSize: 11,
  marginTop: 5,
  letterSpacing: 0.3,
},
});
