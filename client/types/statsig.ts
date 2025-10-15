// Statsig event types and constants

// Landing Page Events
export interface HeaderNavClickedEvent {
  destination: "about" | "pricing" | "book_demo" | "sign_up" | "get_started";
  source_page: "landing";
}

export interface EmailSubscriptionEvent {
  email: string;
  success?: boolean;
  error?: string;
}

export interface ScenarioPreviewEvent {
  action: "scenario_selected" | "position_entered" | "personality_selected";
  value: string;
}

// Pricing Page Events
export interface PricingPlanEvent {
  plan_name: string;
  plan_price: number | "custom";
  included_users: number | string;
  is_enterprise: boolean;
  action: "start_trial" | "contact_sales";
}

// Contact Page Events
export interface ContactFormEvent {
  subject: string;
  has_company: boolean;
  success?: boolean;
  error?: string;
}

// Event Names
export const STATSIG_EVENTS = {
  // Landing Page
  LANDING_PAGE_VIEWED: "landing_page_viewed",
  HEADER_NAV_CLICKED: "header_nav_clicked",
  HEADER_CTA_CLICKED: "header_cta_clicked",
  HERO_CTA_CLICKED: "hero_cta_clicked",
  EMAIL_SUBSCRIPTION_ATTEMPTED: "email_subscription_attempted",
  EMAIL_SUBSCRIPTION_SUCCESS: "email_subscription_success",
  EMAIL_SUBSCRIPTION_FAILED: "email_subscription_failed",
  SCENARIO_PREVIEW_SCENARIO_SELECTED: "scenario_preview_scenario_selected",
  SCENARIO_PREVIEW_POSITION_ENTERED: "scenario_preview_position_entered",
  SCENARIO_PREVIEW_PERSONALITY_SELECTED:
    "scenario_preview_personality_selected",
  FOOTER_LINK_CLICKED: "footer_link_clicked",

  // Pricing Page
  PRICING_PAGE_VIEWED: "pricing_page_viewed",
  PRICING_HEADER_NAV_CLICKED: "pricing_header_nav_clicked",
  PRICING_HEADER_CTA_CLICKED: "pricing_header_cta_clicked",
  PRICING_PLAN_VIEWED: "pricing_plan_viewed",
  PRICING_PLAN_CTA_CLICKED: "pricing_plan_cta_clicked",

  // Contact Page
  CONTACT_PAGE_VIEWED: "contact_page_viewed",
  CONTACT_HEADER_NAV_CLICKED: "contact_header_nav_clicked",
  CONTACT_HEADER_CTA_CLICKED: "contact_header_cta_clicked",
  CONTACT_FORM_FIELD_FOCUSED: "contact_form_field_focused",
  CONTACT_FORM_SUBMITTED: "contact_form_submitted",
  CONTACT_FORM_SUCCESS: "contact_form_success",
  CONTACT_FORM_FAILED: "contact_form_failed",
  CONTACT_INFO_EMAIL_CLICKED: "contact_info_email_clicked",
  CONTACT_INFO_DEMO_CLICKED: "contact_info_demo_clicked",

  // Auth
  AUTH_MODAL_OPENED: "auth_modal_opened",
} as const;

export type StatsigEventName =
  (typeof STATSIG_EVENTS)[keyof typeof STATSIG_EVENTS];

// Common event properties
export interface BaseEventProperties {
  timestamp?: number;
  environment?: string;
  page?: string;
  user_agent?: string;
  url?: string;
}

// Combined event types
export type StatsigEventProperties =
  | HeaderNavClickedEvent
  | EmailSubscriptionEvent
  | ScenarioPreviewEvent
  | PricingPlanEvent
  | ContactFormEvent
  | BaseEventProperties;
