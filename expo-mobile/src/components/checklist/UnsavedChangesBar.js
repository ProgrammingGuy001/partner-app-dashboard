import { Alert, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button, Text } from "@/components/ui";
import useChecklistStore from "../../store/checklistStore";

const UnsavedChangesBar = () => {
  const unsavedCount = useChecklistStore((state) => Object.keys(state.dirtyItems).length);
  const hasUnsavedChanges = unsavedCount > 0;
  const isSaving = useChecklistStore((state) => state.isSaving);
  const saveChanges = useChecklistStore((state) => state.saveChanges);
  const discardChanges = useChecklistStore((state) => state.discardChanges);

  if (!hasUnsavedChanges) return null;

  return (
    <View className="flex-row items-center gap-2.5 rounded-xl border border-warning-muted bg-warning-muted p-3 mb-3">
      <View className="rounded-[10px] bg-warning-muted p-2">
        <Ionicons name="warning-outline" size={16} color="#92400e" />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-bold text-warning-muted-foreground">
          {unsavedCount} unsaved change{unsavedCount > 1 ? "s" : ""}
        </Text>
        <Text className="text-[11px] text-warning-muted-foreground mt-0.5">
          Save before leaving.
        </Text>
      </View>
      <View className="flex-row gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={isSaving}
          onPress={() =>
            Alert.alert("Discard changes?", "All unsaved edits will be lost.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Discard",
                style: "destructive",
                onPress: discardChanges,
              },
            ])
          }
        >
          <Text className="text-warning-muted-foreground text-xs">Discard</Text>
        </Button>
        <Button size="sm" loading={isSaving} onPress={saveChanges}>
          <Text className="text-xs">Save</Text>
        </Button>
      </View>
    </View>
  );
};

export default UnsavedChangesBar;
