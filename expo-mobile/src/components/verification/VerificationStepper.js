import React from "react";
import { View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui/text";
import { VERIFICATION_STEPS } from "../../util/constants";
import { useTheme } from "../../hooks/useTheme";

const STEPS = [
  {
    id: VERIFICATION_STEPS.PAN,
    name: "PAN",
    icon: "card-outline",
    doneIcon: "card",
  },
  {
    id: VERIFICATION_STEPS.BANK,
    name: "Bank",
    icon: "wallet-outline",
    doneIcon: "wallet",
  },
  {
    id: VERIFICATION_STEPS.DOCUMENT,
    name: "Docs",
    icon: "document-text-outline",
    doneIcon: "document-text",
  },
];

const VerificationStepper = ({
  currentStep,
  isPanVerified,
  isBankVerified,
}) => {
  const { colors } = useTheme();
  const getStatus = (stepId) => {
    if (stepId === VERIFICATION_STEPS.PAN)
      return isPanVerified
        ? "done"
        : currentStep === stepId
          ? "active"
          : "idle";
    if (stepId === VERIFICATION_STEPS.BANK)
      return isBankVerified
        ? "done"
        : currentStep === stepId
          ? "active"
          : "idle";
    return currentStep === stepId ? "active" : "idle";
  };

  return (
    <View className="flex-row items-center">
      {STEPS.map((step, index) => {
        const status = getStatus(step.id);
        const isLast = index === STEPS.length - 1;

        const circleColor =
          status === "done"
            ? colors.primary
            : status === "active"
              ? colors.primary
              : colors.border;
        const circleBg =
          status === "done"
            ? colors.primaryLight
            : status === "active"
              ? colors.primary + "10"
              : colors.background;
        const lineColor = status === "done" ? colors.primary : colors.border;

        return (
          <React.Fragment key={step.id}>
            <View className="items-center gap-2 z-10">
              <View
                className={`w-12 h-12 rounded-full items-center justify-center ${status === "active" ? "border-2" : "border"}`}
                style={{
                  backgroundColor: circleBg,
                  borderColor: circleColor,
                }}
              >
                {status === "done" ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={colors.primary}
                  />
                ) : (
                  <Ionicons
                    name={status === "active" ? step.doneIcon : step.icon}
                    size={20}
                    color={
                      status === "active" ? colors.primary : colors.textMuted
                    }
                  />
                )}
              </View>
              <Text
                className={`text-xs uppercase ${status === "idle" ? "font-semibold" : "font-extrabold"}`}
                style={{
                  color: status === "idle" ? colors.textMuted : colors.primary,
                }}
              >
                {step.name}
              </Text>
            </View>

            {!isLast && (
              <View
                className="flex-1 h-0.5 -mx-2 mb-5 rounded-[1px]"
                style={{
                  backgroundColor: lineColor,
                  opacity: status === "done" ? 1 : 0.5,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

export default VerificationStepper;
