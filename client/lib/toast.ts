import { toast as showToast } from "@/hooks/use-toast";

export const toast = {
  success: (message: string) => {
    showToast({
      title: "Success",
      description: message,
      variant: "success",
    });
  },
  error: (message: string) => {
    showToast({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  },
  info: (message: string) => {
    showToast({
      title: "Info",
      description: message,
    });
  },
};
