// ============================================================
// PRIME BOOK ACCOUNTING — CLIENT PORTAL
// Full feature parity with Employee Portal + Client Sign Up
// ============================================================

import {  ClerkProvider,  SignedIn,  SignedOut,  useSignIn,  useSignUp,  useUser,  useClerk,} from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import React, { useState, useEffect, useCallback } from "react";
import {  StyleSheet,  Text,  View,  TextInput,  TouchableOpacity,  Alert,  Linking,  SafeAreaView,  ScrollView,  RefreshControl,  ActivityIndicator, Platform,  StatusBar,  KeyboardAvoidingView,} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";
import { decode } from "base64-arraybuffer";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});


// ─── CONSTANTS ──────────────────────────────────────────────
const WHATSAPP_NUMBER = "+971521859433";
const PUBLISHABLE_KEY = "pk_live_Y2xlcmsucHJpbWVib29rdWFlLmNvbSQ";

// ─── TOKEN CACHE (SecureStore) ───────────────────────────────
const tokenCache = {
  async getToken(key) {
    try { return await SecureStore.getItemAsync(key); }
    catch { return null; }
  },
  async saveToken(key, value) {
    try { await SecureStore.setItemAsync(key, value); }
    catch { return; }
  },
  async clearToken(key) {
    try { await SecureStore.deleteItemAsync(key); }
    catch { return; }
  },
};

// ─── HELPERS ────────────────────────────────────────────────
const openWhatsApp = (type) => {
  const message =
    type === "reports"
      ? "Hi Prime Book Accounting, I would like to request a copy of my latest Financial Reports."
      : "Hello Prime Book Accounting, I have a general inquiry about my Accounting or Tax Status.";
  const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() =>
    Alert.alert("Error", "Please ensure WhatsApp is installed.")
  );
};

const formatBytes = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const statusColor = (s) => {
  if (!s) return "#999";
  if (s === "FILED" || s === "DONE") return "#2ecc71";
  if (s === "PENDING") return "#f1c40f";
  if (s === "OVERDUE") return "#e74c3c";
  if (s === "N/A") return "#aaa";
  return "#999";
};

// ─── LOGO BLOCK ─────────────────────────────────────────────
function LogoBlock() {
  return (
    <View style={styles.logoBlock}>
      <Text style={styles.logoTitle}>PRIME BOOK</Text>
      <Text style={styles.logoSub}>Accounting & Bookkeeping</Text>
      <Text style={styles.nanosubtitle}>ACCURACY • COMPLIANCE • GROWTH</Text>
    </View>
  );
}


// ─── AUTH SCREEN ─────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("signin");

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.authContainer}>
          <LogoBlock />

          <View style={styles.authTabRow}>
            <TouchableOpacity
              style={[styles.authTab, mode === "signin" && styles.authTabActive]}
              onPress={() => setMode("signin")}
            >
              <Text style={[styles.authTabText, mode === "signin" && styles.authTabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authTab, mode === "signup" && styles.authTabActive]}
              onPress={() => setMode("signup")}
            >
              <Text style={[styles.authTabText, mode === "signup" && styles.authTabTextActive]}>
                New Client
              </Text>
            </TouchableOpacity>
          </View>

          {mode === "signin" ? <SignInForm /> : <SignUpForm />}

          <View style={styles.footerContainer}>
            <Text style={styles.footerLock}>🔒 Authorized Client Access Only</Text>
            <Text style={styles.footerSub}>Prime Book Accounting • Dubai, UAE 🇦🇪</Text>
            <Text style={styles.footerPrivacy}>
              Your data is Encrypted and Securely stored. We never share your information with third parties.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}



// ─── SIGN IN FORM ────────────────────────────────────────────
function SignInForm() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);

  const onRequestCode = async () => {
    if (!isLoaded) return;
    const normalised = email.trim().toLowerCase();
    if (!normalised) {
      Alert.alert("Required", "Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await signIn.create({ identifier: normalised, strategy: "email_code" });
      setPending(true);
      Alert.alert("Code Sent", "Check your email inbox for the 6-digit code.");
    } catch (err) {
      Alert.alert("Error", err.errors?.[0]?.message || "Could not send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    if (!code.trim()) {
      Alert.alert("Required", "Please enter the verification code.");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: "email_code", code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
      }
    } catch (err) {
      Alert.alert("Verification Failed", err.errors?.[0]?.message || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  if (!pending) {
    return (
      <View style={styles.formCard}>
        <Text style={styles.formCardTitle}>Welcome Back</Text>
        <Text style={styles.formCardSub}>
          Enter your registered email to receive a secure access code.
        </Text>

        <Text style={styles.label}>Client Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={styles.input}
          placeholder="client.tax@company.com"
          placeholderTextColor="#bbb"
          value={email}
          onChangeText={setEmail}
          returnKeyType="done"
          onSubmitEditing={onRequestCode}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onRequestCode}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.buttonText}>Get Access Code</Text>
          }
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.formCard}>
      <Text style={styles.formCardTitle}>Enter Your Code</Text>
      <Text style={styles.formCardSub}>A 6-digit code was sent to</Text>
      <Text style={styles.codeEmailDisplay}>{email}</Text>

      <Text style={styles.label}>Verification Code</Text>
      <TextInput
        style={[styles.input, styles.codeInput]}
        placeholder="• • • • • •"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        returnKeyType="done"
        onSubmitEditing={onVerify}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#b89733" }, loading && styles.buttonDisabled]}
        onPress={onVerify}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.buttonText}>Verify & Enter Portal</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backLink}
        onPress={() => { setPending(false); setCode(""); }}
      >
        <Text style={styles.backLinkText}>← Use a different email</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── SIGN UP FORM ────────────────────────────────────────────
function SignUpForm() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (!isLoaded) return;
    if (!firstName.trim() || !email.trim()) {
      Alert.alert("Required", "Please enter your First Name and Email Address.");
      return;
    }
    setLoading(true);
    try {
      await signUp.create({
        emailAddress: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPending(true);
      Alert.alert("Code Sent", "A verification code has been sent to your email.");
    } catch (err) {
      Alert.alert(
        "Registration Error",
        err.errors?.[0]?.message || "Could not create account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    if (!code.trim()) {
      Alert.alert("Required", "Please enter the verification code.");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
      } else {
        Alert.alert("Incomplete", "Verification not complete. Please try again.");
      }
    } catch (err) {
      Alert.alert(
        "Verification Failed",
        err.errors?.[0]?.message || "Invalid or expired code."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!pending) {
    return (
      <View style={styles.formCard}>
        <Text style={styles.formCardTitle}>Create Your Account</Text>
        <Text style={styles.formCardSub}>
          Register to access your Prime Book Client Portal • Compliance Status, Documents, and Direct Advisor Contact.
        </Text>

        <View style={styles.nameRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Jijo"
              placeholderTextColor="#bbb"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="George"
              placeholderTextColor="#bbb"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
        </View>

        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={styles.input}
          placeholder="jijo.george@company.com"
          placeholderTextColor="#bbb"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.privacyNotice}>
          <Text style={styles.privacyNoticeText}>
            🔐  By registering, your data is encrypted end-to-end and stored securely.
            Prime Book will never share your information with third parties.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.buttonText}>Register & Get Code</Text>
          }
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.formCard}>
      <Text style={styles.formCardTitle}>Verify Your Email</Text>
      <Text style={styles.formCardSub}>A 6-digit code was sent to</Text>
      <Text style={styles.codeEmailDisplay}>{email}</Text>

      <Text style={styles.label}>Verification Code</Text>
      <TextInput
        style={[styles.input, styles.codeInput]}
        placeholder="• • • • • •"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        returnKeyType="done"
        onSubmitEditing={onVerify}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#b89733" }, loading && styles.buttonDisabled]}
        onPress={onVerify}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.buttonText}>Verify & Enter Portal</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backLink}
        onPress={() => { setPending(false); setCode(""); }}
      >
        <Text style={styles.backLinkText}>← Edit details</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── DASHBOARD ──────────────────────────────────────────────
function Dashboard() {
  const { signOut } = useClerk();
  const { user } = useUser();

  const clientEmail = user?.primaryEmailAddress?.emailAddress || "";
  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const displayName = fullName || clientEmail.split("@")[0];
  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : displayName[0]?.toUpperCase() || "C";

  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [myDocs, setMyDocs] = useState([]);
  const [loadingMyDocs, setLoadingMyDocs] = useState(true);
  const [sharedDocs, setSharedDocs] = useState([]);
  const [loadingSharedDocs, setLoadingSharedDocs] = useState(true);
  const [compliance, setCompliance] = useState(null);
  const [loadingCompliance, setLoadingCompliance] = useState(true);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  

  // ── Fetch my uploads ──
  const fetchMyDocs = useCallback(async () => {
    if (!clientEmail) return;
    try {
      const { data, error } = await supabase.storage
        .from("client-documents")
        .list(`uploads/${clientEmail}/`, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });
      if (error) throw error;
      setMyDocs((data || []).filter((d) => d.metadata?.size > 0));
    } catch (err) {
      console.error("fetchMyDocs:", err);
    } finally {
      setLoadingMyDocs(false);
    }
  }, [clientEmail]);

  // ── Fetch Prime Book shared docs ──
  const fetchSharedDocs = useCallback(async () => {
    if (!clientEmail) return;
    try {
      const { data, error } = await supabase.storage
        .from("client-documents")
        .list(`shared/${clientEmail}/`, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });
      if (error && error.message !== "The resource was not found") throw error;
      setSharedDocs((data || []).filter((d) => d.metadata?.size > 0));
    } catch (err) {
      console.error("fetchSharedDocs:", err);
    } finally {
      setLoadingSharedDocs(false);
    }
  }, [clientEmail]);

  // ── Fetch compliance ──
  const fetchCompliance = useCallback(async () => {
    if (!clientEmail) return;
    try {
      const { data, error } = await supabase
        .from("client_compliance")
        .select("*")
        .eq("client_email", clientEmail)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      setCompliance(
        data || {
          vat_status: "PENDING",
          vat_due: "May 28, 2026",
          ct_status: "PENDING",
          ct_due: "September 30, 2026",
        }
      );
    } catch (err) {
      console.error("fetchCompliance:", err);
    } finally {
      setLoadingCompliance(false);
    }
  }, [clientEmail]);



  useEffect(() => {
    fetchMyDocs();
    fetchSharedDocs();
    fetchCompliance();
    registerForPushNotifications();
  }, [fetchMyDocs, fetchSharedDocs, fetchCompliance, registerForPushNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMyDocs(), fetchSharedDocs(), fetchCompliance()]);
    setRefreshing(false);
  }, [fetchMyDocs, fetchSharedDocs, fetchCompliance]);

  // ── Upload ──
  const uploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      let ok = 0, fail = 0;
      for (const file of result.assets) {
        try {
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const arrayBuffer = decode(base64);
          const clean = file.name.replace(/\s+/g, "_");
          const ext = clean.includes(".") ? clean.split(".").pop() : "";
          const base = ext ? clean.slice(0, -(ext.length + 1)) : clean;
          const path = `uploads/${clientEmail}/${base}_${Date.now()}.${ext}`;
          const { error } = await supabase.storage
            .from("client-documents")
            .upload(path, arrayBuffer, {
              contentType: file.mimeType || "application/octet-stream",
              upsert: true,
            });
          if (error) throw error;
          ok++;
        } catch { fail++; }
      }
      Alert.alert(
        fail === 0 ? "Uploaded ✓" : "Partial Upload",
        `${ok} file(s) uploaded${fail ? `, ${fail} failed` : ""}.`
      );
      await fetchMyDocs();
    } catch (err) {
      Alert.alert("Upload Failed", err.message || "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // ── View doc ──
  const viewDocument = async (fileName, folder = "uploads") => {
    try {
      const { data, error } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(`${folder}/${clientEmail}/${fileName}`, 300);
      if (error) throw error;
      await Linking.openURL(data.signedUrl);
    } catch {
      Alert.alert("Error", "Could not open document. Please try again.");
    }
  };

  // ── Delete single ──
  const deleteDocument = (fileName) => {
    Alert.alert("Delete Document", `Remove "${fileName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const { error } = await supabase.storage
            .from("client-documents")
            .remove([`uploads/${clientEmail}/${fileName}`]);
          if (error) Alert.alert("Error", "Delete failed.");
          else await fetchMyDocs();
        },
      },
    ]);
  };

  // ── Bulk delete ──
  const deleteSelected = () => {
    if (!selectedFiles.length) return;
    Alert.alert("Bulk Delete", `Remove ${selectedFiles.length} file(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete All", style: "destructive",
        onPress: async () => {
          const paths = selectedFiles.map((n) => `uploads/${clientEmail}/${n}`);
          const { error } = await supabase.storage
            .from("client-documents").remove(paths);
          if (error) Alert.alert("Error", "Could not complete bulk delete.");
          else {
            setSelectedFiles([]);
            setIsSelectMode(false);
            await fetchMyDocs();
          }
        },
      },
    ]);
  };

  const toggleSelect = (fileName) =>
    setSelectedFiles((prev) =>
      prev.includes(fileName) ? prev.filter((f) => f !== fileName) : [...prev, fileName]
    );

  const selectAllFiles = () => {
    const all = myDocs.map((d) => d.name);
    setSelectedFiles(selectedFiles.length === all.length ? [] : all);
  };

  const handleLogout = () => {
    Alert.alert(
      "Secure Logout",
      "Are you sure you want to sign out of your Prime Book portal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out", style: "destructive",
          onPress: async () => {
            try { await signOut(); }
            catch { Alert.alert("Error", "Logout failed."); }
          },
        },
      ]
    );
  };

  const registerForPushNotifications = useCallback(async () => {
  if (!clientEmail) return;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "03f344a6-4c96-4d88-8f85-c392c1c49cc2", // ← replace with yours from app.json
    });

    await supabase
      .from("client_push_tokens")
      .upsert({
        client_email: clientEmail,
        push_token: tokenData.data,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_email" });

  } catch (err) {
    console.error("Push token error:", err);
  }
}, [clientEmail]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>PRIME BOOK</Text>
          <Text style={styles.topBarSub}>Client Portal</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={styles.topBarAvatar}>
            <Text style={styles.topBarAvatarText}>{initials}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={{ marginTop: 3 }}>
            <Text style={styles.logoutText}>Secure Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#b89733"]}
            tintColor="#b89733"
          />
        }
      >
        {/* ── Client Name Hero ── */}
        <View style={styles.heroSection}>
          <Text style={styles.heroWelcome}>Welcome Back,</Text>
          <Text style={styles.heroName}>{displayName.toUpperCase()}</Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroEmail}>{clientEmail}</Text>
        </View>

        {/* ── Compliance Card ── */}
        <View style={styles.statusCard}>
          <View style={styles.statusCardHeader}>
            <Text style={styles.statusCardTitle}>Compliance Status</Text>
            <Text style={styles.statusCardLive}>● LIVE</Text>
          </View>

          {loadingCompliance ? (
            <ActivityIndicator color="#b89733" size="small" style={{ marginTop: 6 }} />
          ) : compliance ? (
            <>
              <View style={styles.statusRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusLabel}>VAT Returns Filing</Text>
                  <Text style={styles.statusDue}>Due: {compliance.vat_due}</Text>
                </View>
                <View style={[styles.statusBadge, { borderColor: statusColor(compliance.vat_status) }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor(compliance.vat_status) }]}>
                    ● {compliance.vat_status}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.statusRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusLabel}>Corporate Tax Filing</Text>
                  <Text style={styles.statusDue}>Due: {compliance.ct_due}</Text>
                </View>
                <View style={[styles.statusBadge, { borderColor: statusColor(compliance.ct_status) }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor(compliance.ct_status) }]}>
                    ● {compliance.ct_status}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* ── Action Grid ── */}
        <View style={styles.menuGrid}>
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: "#132a50ee" }]}
            onPress={uploadDocument}
            disabled={uploading}
          >
            <Text style={styles.menuIcon}>📁</Text>
            <Text style={[styles.menuText, { color: "#fff" }]}>
              {uploading ? "Uploading..." : "Upload Documents"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: "#b89733" }]}
            onPress={() => openWhatsApp("reports")}
          >
            <Text style={styles.menuIcon}>📊</Text>
            <Text style={[styles.menuText, { color: "#fff" }]}>Request Reports</Text>
          </TouchableOpacity>
        </View>

        {/* ── Documents from Prime Book ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Documents from Prime Book</Text>
          <Text style={styles.sectionSub}>Sent by your Accounting Team • read only</Text>

          {loadingSharedDocs ? (
            <ActivityIndicator color="#b89733" style={{ marginTop: 10 }} />
          ) : sharedDocs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxIcon}>📭</Text>
              <Text style={styles.emptyText}>No documents yet.</Text>
              <Text style={styles.emptySubText}>
                Your team will upload statements, reports and filings here.
              </Text>
            </View>
          ) : (
            sharedDocs.map((doc, i) => (
              <TouchableOpacity
                key={i}
                style={styles.documentRow}
                onPress={() => viewDocument(doc.name, "shared")}
                activeOpacity={0.75}
              >
                <Text style={styles.documentIcon}>📤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.documentName} numberOfLines={1}>{doc.name}</Text>
                  <Text style={styles.documentDate}>
                    {formatDate(doc.created_at)} • {formatBytes(doc.metadata?.size)}
                  </Text>
                </View>
                <Text style={styles.viewBtnText}>SHOW</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Divider */}
        <View style={styles.sectionDivider} />

        {/* ── My Submissions ── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>My Uploaded Submissions</Text>
              <Text style={styles.sectionSub}>
                {myDocs.length} file{myDocs.length !== 1 ? "s" : ""} uploaded
              </Text>
            </View>
            {myDocs.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {isSelectMode ? (
                  <>
                    <TouchableOpacity onPress={selectAllFiles} style={{ marginRight: 14 }}>
                      <Text style={styles.selectActionText}>
                        {selectedFiles.length === myDocs.length ? "Unselect All" : "Select All"}
                      </Text>
                    </TouchableOpacity>
                    {selectedFiles.length > 0 && (
                      <TouchableOpacity onPress={deleteSelected}>
                        <Text style={styles.deleteActionText}>
                          Delete ({selectedFiles.length})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setIsSelectMode(true)}>
                    <Text style={styles.selectActionText}>Select</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {loadingMyDocs ? (
            <ActivityIndicator color="#b89733" style={{ marginTop: 10 }} />
          ) : myDocs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxIcon}>📂</Text>
              <Text style={styles.emptyText}>No documents uploaded yet.</Text>
              <Text style={styles.emptySubText}>
                Tap "Upload Documents" above to send files to your Prime Book team.
              </Text>
            </View>
          ) : (
            <>
              {myDocs.map((doc, i) => {
                const isSelected = selectedFiles.includes(doc.name);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.documentRow, isSelected && styles.documentRowSelected]}
                    onPress={() =>
                      isSelectMode ? toggleSelect(doc.name) : viewDocument(doc.name, "uploads")
                    }
                    onLongPress={() => {
                      if (!isSelectMode) {
                        setIsSelectMode(true);
                        toggleSelect(doc.name);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.documentIcon}>
                      {isSelectMode ? (isSelected ? "✅" : "⭕") : "📄"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.documentName} numberOfLines={1}>{doc.name}</Text>
                      <Text style={styles.documentDate}>
                        {formatDate(doc.created_at)} • {formatBytes(doc.metadata?.size)}
                      </Text>
                    </View>
                    {!isSelectMode && (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <TouchableOpacity
                          onPress={() => viewDocument(doc.name, "uploads")}
                          style={{ marginRight: 14 }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.viewBtnText}>VIEW</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteDocument(doc.name)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.deleteBtnText}>DEL</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {isSelectMode && (
                <TouchableOpacity
                  onPress={() => { setIsSelectMode(false); setSelectedFiles([]); }}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ textAlign: "center", color: "#888", fontSize: 13 }}>
                    Cancel Selection
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Connect Advisor ── */}
        <TouchableOpacity
          style={styles.supportButton}
          onPress={() => openWhatsApp("general")}
          activeOpacity={0.85}
        >
          <Text style={styles.supportButtonText}>💬  Connect with Advisor</Text>
        </TouchableOpacity>

        {/* ── Privacy Bar ── */}
        <View style={styles.privacyBar}>
          <Text style={styles.privacyBarText}>
            🔒  Your portal is encrypted and secured. Data is never shared with third parties.
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerLock}>Prime Book Accounting & Bookkeeping</Text>
          <Text style={styles.footerSub}>Dubai, UAE 🇦🇪 • {new Date().getFullYear()}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── ROOT APP ────────────────────────────────────────────────
export default function App() {
  const [fontsLoaded] = useFonts({ PrimeBoldSerif: Cinzel_700Bold });

  useEffect(() => {
    async function hideSplash() {
      if (fontsLoaded) await SplashScreen.hideAsync();
    }
    hideSplash();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <SignedIn>
          <Dashboard />
        </SignedIn>
        <SignedOut>
          <AuthScreen />
        </SignedOut>
      </SafeAreaView>
    </ClerkProvider>
  );
}

// ─── STYLES ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // Auth
  authContainer: { flex: 1, padding: 24, paddingBottom: 40, backgroundColor: "#fff" },
  logoBlock: { marginTop: 150, marginBottom: 24 },
  logoTitle: { fontSize: 30, fontFamily: "PrimeBoldSerif", color: "#b89733", letterSpacing: 2 },
  logoSub: { fontFamily: "PrimeBoldSerif", fontSize: 12, color: "#1a2b48", letterSpacing: 1.5, marginTop: 2 },
  nanosubtitle: { fontSize: 9, color: "#b89733", fontWeight: "900", letterSpacing: .5, marginTop: 4 },
  authTabRow: {
    flexDirection: "row", borderWidth: 1, borderColor: "#eee",
    borderRadius: 12, marginBottom: 20, overflow: "hidden",
  },
  authTab: { flex: 1, paddingVertical: 12, alignItems: "center", backgroundColor: "#f8f9fa" },
  authTabActive: { backgroundColor: "#1a2b48" },
  authTabText: { fontSize: 13, fontWeight: "700", color: "#999" },
  authTabTextActive: { color: "#b89733" },

  // Form card
  formCard: {
    backgroundColor: "#f8f9fa", borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: "#eee", marginBottom: 8,
  },
  formCardTitle: { fontSize: 18, fontFamily: "PrimeBoldSerif", color: "#1a2b48", marginBottom: 6 },
  formCardSub: { fontSize: 12, color: "#999", marginBottom: 18, lineHeight: 18 },
  codeEmailDisplay: { fontSize: 13, fontWeight: "700", color: "#b89733", marginBottom: 16, marginTop: -10 },
  codeInput: { fontSize: 22, letterSpacing: 8, textAlign: "center", fontWeight: "700", color: "#1a2b48" },
  nameRow: { flexDirection: "row" },
  backLink: { marginTop: 14, alignItems: "center" },
  backLinkText: { color: "#888", fontSize: 13 },

  // Privacy notice (sign up)
  privacyNotice: {
    backgroundColor: "#f0f8f0", borderRadius: 10,
    padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#d4edda",
  },
  privacyNoticeText: { fontSize: 11, color: "#2d6a4f", lineHeight: 16 },

  // Form elements
  label: { color: "#1a2b48", fontWeight: "700", marginBottom: 6, fontSize: 12 },
  input: {
    borderWidth: 1, borderColor: "#e0e0e0", padding: 14, borderRadius: 10,
    marginBottom: 14, backgroundColor: "#fff", color: "#122445", fontSize: 14,
  },
  button: {
    backgroundColor: "#1a2b48", padding: 16, borderRadius: 10,
    alignItems: "center", justifyContent: "center", minHeight: 50,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  // Footer (auth)
  footerContainer: { alignItems: "center", marginTop: 24, paddingBottom: 10 },
  footerLock: { color: "#1a2b48", fontSize: 12, fontWeight: "700" },
  footerSub: { color: "#c19e14", fontSize: 11, marginTop: 4, letterSpacing: 0.3 },
  footerPrivacy: { color: "#aaa", fontSize: 10, marginTop: 8, textAlign: "center", lineHeight: 14, paddingHorizontal: 10 },

  // Top bar
  topBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 12,
    paddingTop: (StatusBar.currentHeight || 44) + 12,
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0", backgroundColor: "#fff",
  },
  topBarTitle: { fontFamily: "PrimeBoldSerif", fontSize: 18, color: "#b89733", letterSpacing: 1.5 },
  topBarSub: { fontSize: 10, color: "#999", marginTop: 1 },
  topBarAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#1a2b48", alignItems: "center", justifyContent: "center",
  },
  topBarAvatarText: { color: "#b89733", fontWeight: "bold", fontSize: 13, fontFamily: "PrimeBoldSerif" },
  logoutText: { color: "#e74c3c", fontSize: 11, fontWeight: "600" },

  // Hero name section
  heroSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  heroWelcome: { fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 },
  heroName: { fontSize: 26, fontFamily: "PrimeBoldSerif", color: "#1a2b48", letterSpacing: 2, lineHeight: 34 },
  heroDivider: { width: 42, height: 3, backgroundColor: "#b89733", borderRadius: 2, marginTop: 8, marginBottom: 8 },
  heroEmail: { fontSize: 12, color: "#aaa", letterSpacing: 0.3 },

  // Compliance card
  statusCard: {
    backgroundColor: "#1a2b48", marginHorizontal: 20, marginTop: 16,
    borderRadius: 16, padding: 20, marginBottom: 16,
    elevation: 6, shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6,
  },
  statusCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  statusCardTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  statusCardLive: { color: "#2ecc71", fontSize: 10, fontWeight: "700" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusLabel: { color: "#fff", fontSize: 14, fontWeight: "600" },
  statusDue: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 },
  statusBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontWeight: "700", fontSize: 12 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 14 },

  // Menu grid
  menuGrid: { flexDirection: "row", marginHorizontal: 20, marginBottom: 20, gap: 10 },
  menuItem: { flex: 1, paddingVertical: 22, borderRadius: 14, alignItems: "center" },
  menuIcon: { fontSize: 26, marginBottom: 8 },
  menuText: { fontWeight: "700", fontSize: 12, textAlign: "center" },

  // Sections
  sectionContainer: { marginHorizontal: 20, marginBottom: 4 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a2b48" },
  sectionSub: { fontSize: 11, color: "#999", marginBottom: 10 },
  sectionDivider: { height: 1, backgroundColor: "#f0f0f0", marginHorizontal: 20, marginVertical: 16 },

  // Empty states
  emptyBox: {
    alignItems: "center", paddingVertical: 24,
    backgroundColor: "#f8f9fa", borderRadius: 12,
    borderWidth: 1, borderColor: "#eee", marginBottom: 8,
  },
  emptyBoxIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { color: "#aaa", fontSize: 14, fontWeight: "600" },
  emptySubText: { color: "#ccc", fontSize: 12, marginTop: 4, textAlign: "center", paddingHorizontal: 20 },

  // Document rows
  documentRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    padding: 14, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "#eee",
    elevation: 1, shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,
  },
  documentRowSelected: { borderColor: "#b89733", backgroundColor: "#fffdf5" },
  documentIcon: { fontSize: 22, marginRight: 12 },
  documentName: { fontSize: 13, fontWeight: "600", color: "#1a2b48" },
  documentDate: { fontSize: 11, color: "#999", marginTop: 2 },
  viewBtnText: { color: "#1a2b48", fontSize: 11, fontWeight: "700" },
  deleteBtnText: { color: "#e74c3c", fontSize: 11, fontWeight: "700" },
  selectActionText: { color: "#b89733", fontWeight: "700", fontSize: 12 },
  deleteActionText: { color: "#e74c3c", fontWeight: "700", fontSize: 12 },

  // Support
  supportButton: {
    backgroundColor: "#25D366", marginHorizontal: 20, marginTop: 24,
    padding: 16, borderRadius: 12, alignItems: "center",
  },
  supportButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  // Privacy bar
  privacyBar: {
    marginHorizontal: 20, marginTop: 16, padding: 12,
    backgroundColor: "#f8f9fa", borderRadius: 10, borderWidth: 1, borderColor: "#eee",
  },
  privacyBarText: { fontSize: 11, color: "#999", textAlign: "center", lineHeight: 16 },
});