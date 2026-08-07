const fs = require("fs");

let content = fs.readFileSync(
  "expo-mobile/src/component {4}shboard/DailyAttendance.js",
  "utf8",
);

// 1. Add Modal and ScrollView to imports
content = content.replace(
  "import { View, ActivityIndicator, Image, TouchableOpacity, Alert, TextInput, Linking } from 'react-native';",
  "import { View, ActivityIndicator, Image, TouchableOpacity, Alert, TextInput, Linking, Modal, ScrollView } from 'react-native';",
);

// 2. Add nextSundayISO
content = content.replace(
  "const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;",
  "const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;\n\nfunction nextSundayISO() {\n  const d = new Date();\n  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));\n  const month = String(d.getMonth() + 1).padStart(2, '0');\n  const day = String(d.getDate()).padStart(2, '0');\n  return `${d.getFullYear()}-${month}-${day}`;\n}",
);

// 3. Add state variables inside DailyAttendance
content = content.replace(
  "const [sundayBlocked, setSundayBlocked] = useState(false);",
  "const [sundayBlocked, setSundayBlocked] = useState(false);\n  const [sundayModalVisible, setSundayModalVisible] = useState(false);\n  const [sundayRequests, setSundayRequests] = useState([]);\n  const [requestDate, setRequestDate] = useState(nextSundayISO());",
);

// 4. Add fetchSundayRequests method inside DailyAttendance
content = content.replace(
  "const fetchRecords = useCallback(async (offset = 0) => {",
  "const fetchSundayRequests = async () => {\n    try {\n      const existing = await dashboardApi.getSundayRequests();\n      setSundayRequests(existing || []);\n    } catch (err) {\n      toast.error('Failed to load Sunday requests');\n    }\n  };\n\n  const fetchRecords = useCallback(async (offset = 0) => {",
);

// 5. Replace submitSundayRequest logic to be more generic, and refresh list
content = content.replace(
  /const submitSundayRequest = async \(\) => {[\s\S]*?setSundaySubmitting\(false\);\n}\n};/,
  `const submitSundayRequest = async (isModal = false) => {
    setSundaySubmitting(true);
    try {
      const created = await dashboardApi.createSundayRequest({
        requestDate: isModal ? requestDate : todayISO(),
        reason: sundayReason,
      });
      if (!isModal) {
        setSundayRequest(created);
      }
      setSundayReason('');
      toast.success('Request sent for superadmin approval');
      if (isModal) {
        fetchSundayRequests();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit Sunday work request');
    } finally {
      setSundaySubmitting(false);
    }
  };`,
);

// 6. Add "Manage Sunday Work Requests" button
content = content.replace(
  /(\{\s*sundayBlocked \? \([\s\S]*?\)\s*:\s*null\s*\})/,
  `$1
        <TouchableOpacity
          onPress={() => {
             setRequestDate(nextSundayISO());
             fetchSundayRequests();
             setSundayModalVisible(true);
          }}
          className="mb-3 flex-row items-center justify-between rounded-xl border border-border bg-background p-3"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text className="text-sm font-semibold text-foreground">Manage Sunday Work Requests</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>`,
);

// 7. Add Modal to end of expanded view
content = content.replace(
  /(\{\s*missingReports\.length > 0 \? \([\s\S]*?\)\s*:\s*null\s*\})/,
  `$1`, // Just a marker
);

// Wait, let's insert the modal right before the closing tag of the expanded view.
content = content.replace(
  /(<\/View>\s*)\(\s*:\s*null\s*\}/,
  `
      <Modal
        visible={sundayModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSundayModalVisible(false)}
      >
        <View className="flex-1 bg-background pt-12 px-5">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-lg font-bold text-foreground">Sunday Work Requests</Text>
            <TouchableOpacity onPress={() => setSundayModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1">
            <View className="gap-2 mb-6">
              <Text className="text-sm font-semibold text-foreground">Request for {requestDate}</Text>
              <TextInput
                value={sundayReason}
                onChangeText={setSundayReason}
                placeholder="Reason (optional)"
                placeholderTextColor={colors.textMuted}
                maxLength={500}
                style={{ color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, height: 48 }}
              />
              <Button disabled={sundaySubmitting} onPress={() => submitSundayRequest(true)}>
                <Text>{sundaySubmitting ? 'Sending...' : 'Request Sunday work'}</Text>
              </Button>
            </View>

            <Text className="text-sm font-semibold text-foreground mb-3">Previous Requests</Text>
            {sundayRequests.length === 0 ? (
              <Text className="text-sm text-muted-foreground">No requests found.</Text>
            ) : (
              <View className="gap-3 pb-8">
                {sundayRequests.map((req) => (
                  <View key={req.id} className="rounded-xl border border-border p-3 gap-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-foreground">{req.request_date}</Text>
                      <Text className={\`text-xs font-bold \${req.status === 'approved' ? 'text-green-600' : req.status === 'rejected' ? 'text-destructive' : 'text-orange-500'}\`}>
                        {req.status.toUpperCase()}
                      </Text>
                    </View>
                    {req.reason ? <Text className="text-xs text-muted-foreground mt-1">Reason: {req.reason}</Text> : null}
                    {req.review_notes ? <Text className="text-xs text-muted-foreground mt-1">Notes: {req.review_notes}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
$1( : null}`,
);

fs.writeFileSync(
  "expo-mobile/src/components/dashboard/DailyAttendance.js",
  content,
);
