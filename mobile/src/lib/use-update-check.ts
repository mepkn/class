import { useEffect } from "react";
import { Alert } from "react-native";
import { checkForUpdate, currentCommit, deleteDownloadedUpdates, installUpdate } from "./update";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Checks for a new release; manual (from the Lessons tab) also reports "up to date" and errors. */
export async function runUpdateCheck(manual: boolean): Promise<void> {
  try {
    const result = await checkForUpdate();
    if (result.kind === "available") {
      Alert.alert("Update available", `Version ${result.tag} is available (you have ${currentCommit}). Download and install it now?`, [
        { text: "Later", style: "cancel" },
        {
          text: "Update",
          onPress: () => {
            installUpdate(result.url).catch((e: unknown) => Alert.alert("Update failed", message(e)));
          },
        },
      ]);
    } else if (manual) {
      if (result.kind === "dev") Alert.alert("Updates are off", "This is a development build.");
      else Alert.alert("You're up to date", `${currentCommit} is the latest version.`);
    }
  } catch (e) {
    if (manual) Alert.alert("Update failed", message(e));
  }
}

/** On launch: delete the APK an earlier update left, then look for a new one. */
export function useUpdateCheck(): void {
  useEffect(() => {
    deleteDownloadedUpdates();
    void runUpdateCheck(false);
  }, []);
}
