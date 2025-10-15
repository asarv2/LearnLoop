"use client";

import { STATSIG_EVENTS, StatsigEventName } from "@/types/statsig";
import { useStatsigClient } from "@statsig/react-bindings";

export const useStatsigAnalytics = () => {
  const { client } = useStatsigClient();

  const logEvent = (
    eventName: StatsigEventName,
    properties?: Record<string, string | number | boolean>
  ) => {
    if (!client) {
      console.warn("Statsig client not available");
      return;
    }

    const eventProperties = {
      ...properties,
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || "development",
      page: typeof window !== "undefined" ? window.location.pathname : "",
      url: typeof window !== "undefined" ? window.location.href : "",
      user_agent:
        typeof window !== "undefined" ? window.navigator.userAgent : "",
    };

    const jsonEventProperties = JSON.stringify(eventProperties);
    client.logEvent(eventName, jsonEventProperties);
  };

  // Convenience methods for common events
  const logPageView = (pageName: string) => {
    logEvent("landing_page_viewed" as StatsigEventName, { page: pageName });
  };

  const logNavigationClick = (destination: string, sourcePage: string) => {
    logEvent(STATSIG_EVENTS.HEADER_NAV_CLICKED, {
      destination,
      source_page: sourcePage,
    });
  };

  const logCTAClick = (buttonName: string, page: string) => {
    logEvent(STATSIG_EVENTS.HEADER_CTA_CLICKED, {
      destination: buttonName,
      source_page: page,
    });
  };

  const logFormSubmission = (
    formType: "email_subscription" | "contact_form",
    success: boolean,
    data?: Record<string, string | number | boolean>
  ) => {
    if (formType === "email_subscription") {
      if (success) {
        logEvent(STATSIG_EVENTS.EMAIL_SUBSCRIPTION_SUCCESS, {
          email: data?.email || "",
          success: true,
        });
      } else {
        logEvent(STATSIG_EVENTS.EMAIL_SUBSCRIPTION_FAILED, {
          email: data?.email || "",
          success: false,
          error: data?.error || "Unknown error",
        });
      }
    } else if (formType === "contact_form") {
      if (success) {
        logEvent(STATSIG_EVENTS.CONTACT_FORM_SUCCESS, {
          subject: data?.subject || "",
          has_company: !!data?.company,
          success: true,
        });
      } else {
        logEvent(STATSIG_EVENTS.CONTACT_FORM_FAILED, {
          subject: data?.subject || "",
          has_company: !!data?.company,
          success: false,
          error: data?.error || "Unknown error",
        });
      }
    }
  };

  const logPricingPlanClick = (
    planData: Record<string, string | number | boolean>
  ) => {
    logEvent(STATSIG_EVENTS.PRICING_PLAN_CTA_CLICKED, planData);
  };

  return {
    logEvent,
    logPageView,
    logNavigationClick,
    logCTAClick,
    logFormSubmission,
    logPricingPlanClick,
    STATSIG_EVENTS,
  };
};
