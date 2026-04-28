import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import * as Updates from "expo-updates";
import Loader from "../components/common/Loader";
import { logger } from "../util/helpers";

const SplashScreen = () => {
  const [updateMessage, setUpdateMessage] = useState("Checking for updates...");

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      // Skip update check in development
      if (__DEV__) {
        logger.info("SplashScreen", "Development mode - skipping update check");
        setUpdateMessage("Checking session...");
        return;
      }

      logger.info("SplashScreen", "Checking for OTA updates...");
      
      // Check if updates are available
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        logger.info("SplashScreen", "Update available - downloading...");
        setUpdateMessage("Downloading update...");
        
        // Download the update
        await Updates.fetchUpdateAsync();
        
        logger.info("SplashScreen", "Update downloaded - reloading app...");
        setUpdateMessage("Installing update...");
        
        // Reload the app to apply the update
        await Updates.reloadAsync();
      } else {
        logger.info("SplashScreen", "App is up to date");
        setUpdateMessage("Checking session...");
      }
    } catch (error) {
      // If update check fails, continue with app launch
      logger.warn("SplashScreen", `Update check failed: ${error.message}`);
      setUpdateMessage("Checking session...");
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-background px-5">
      <Image
        source={require("../../assets/icon.png")}
        style={{ width: 52, height: 52, borderRadius: 14, marginBottom: 28 }}
        resizeMode="contain"
      />
      <Loader text={updateMessage} />
    </View>
  );
};

export default SplashScreen;
