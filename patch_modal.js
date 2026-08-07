const fs = require("node:fs");

let content = fs.readFileSync(
  "expo-mobile/src/components/dashboard/DailyAttendance.js",
  "utf8",
);

const modalCode = `
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
      ) : null}`;

content = content.replace("      ) : null}", modalCode);

fs.writeFileSync(
  "expo-mobile/src/components/dashboard/DailyAttendance.js",
  content,
);
