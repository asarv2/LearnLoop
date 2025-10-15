"use client";

import { AlertCircle, CheckCircle2, CreditCard, Users } from "lucide-react";
import { useState } from "react";

interface AddUsersModalProps {
  open: boolean;
  onClose: () => void;
  company: string;
  currentPlan: string;
}

interface PlanInfo {
  name: string;
  maxUsers: number;
  currentUsers: number;
  additionalUserPrice: number;
  additionalUserLimit: number;
}

const PLAN_DETAILS: Record<string, PlanInfo> = {
  starter: {
    name: "Starter",
    maxUsers: 50,
    currentUsers: 0, // Will be fetched
    additionalUserPrice: 50, // $50 per additional user per year
    additionalUserLimit: 20, // Can add up to 20 additional users
  },
  growth: {
    name: "Growth",
    maxUsers: 100,
    currentUsers: 0,
    additionalUserPrice: 40, // $40 per additional user per year
    additionalUserLimit: 25, // Can add up to 25 additional users
  },
  professional: {
    name: "Professional",
    maxUsers: 250,
    currentUsers: 0,
    additionalUserPrice: 30, // $30 per additional user per year
    additionalUserLimit: 40, // Can add up to 40 additional users
  },
  scale: {
    name: "Scale",
    maxUsers: 500,
    currentUsers: 0,
    additionalUserPrice: 25, // $25 per additional user per year
    additionalUserLimit: 60, // Can add up to 60 additional users
  },
  enterprise: {
    name: "Enterprise",
    maxUsers: 999999,
    currentUsers: 0,
    additionalUserPrice: 0, // Custom pricing - contact for quote
    additionalUserLimit: 999999,
  },
};

export default function AddUsersModal({
  open,
  onClose,
  company,
  currentPlan,
}: AddUsersModalProps) {
  const [usersToAdd, setUsersToAdd] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const planInfo = PLAN_DETAILS[currentPlan] || PLAN_DETAILS.starter;
  const maxAdditionalUsers = Math.min(
    planInfo.additionalUserLimit,
    planInfo.maxUsers - planInfo.currentUsers
  );
  const totalCost = usersToAdd * planInfo.additionalUserPrice;

  const handleSubmit = async () => {
    if (usersToAdd <= 0) {
      setSubmitStatus("error");
      setSubmitMessage("Please select at least 1 user to add.");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      const response = await fetch("/api/v1/add-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company,
          currentPlan,
          usersToAdd,
          totalCost: planInfo.additionalUserPrice > 0 ? totalCost : 0,
          requestedBy: company, // You might want to get this from auth context
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus("success");
        setSubmitMessage(
          `Successfully requested ${usersToAdd} additional users. We'll contact you within 24 hours to process your request.`
        );
        // Reset form after 3 seconds and close modal
        setTimeout(() => {
          setUsersToAdd(0);
          setSubmitStatus("idle");
          onClose();
        }, 3000);
      } else {
        setSubmitStatus("error");
        setSubmitMessage(
          data.error || "Something went wrong. Please try again."
        );
      }
    } catch {
      setSubmitStatus("error");
      setSubmitMessage(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setUsersToAdd(0);
    setSubmitStatus("idle");
    setSubmitMessage("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Add Users</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Plan Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-3">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Current Plan</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Plan:</span>
                <span className="font-medium text-gray-900">
                  {planInfo.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Users:</span>
                <span className="font-medium text-gray-900">
                  {planInfo.maxUsers.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Users:</span>
                <span className="font-medium text-gray-900">
                  {planInfo.currentUsers}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Available Slots:</span>
                <span className="font-medium text-gray-900">
                  {maxAdditionalUsers}
                </span>
              </div>
            </div>
          </div>

          {/* Users to Add Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              How many additional users would you like to add?
            </label>

            <div className="space-y-4">
              {/* Number Input */}
              <div className="flex justify-center">
                <input
                  type="number"
                  min="0"
                  max={maxAdditionalUsers}
                  value={usersToAdd}
                  onChange={(e) =>
                    setUsersToAdd(
                      Math.max(
                        0,
                        Math.min(
                          maxAdditionalUsers,
                          parseInt(e.target.value) || 0
                        )
                      )
                    )
                  }
                  className="w-32 px-4 py-3 border border-gray-300 rounded-xl text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="text-center">
                <span className="text-2xl font-bold text-gray-900">
                  {usersToAdd}
                </span>
                <span className="text-gray-600 ml-1">
                  {usersToAdd === 1 ? "user" : "users"} to add
                </span>
              </div>
            </div>
          </div>

          {/* Cost Information */}
          {usersToAdd > 0 && (
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900">
                  Cost Information
                </h4>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Additional Users:</span>
                  <span className="text-blue-900 font-medium">
                    {usersToAdd}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Price per User:</span>
                  <span className="text-blue-900 font-medium">
                    {planInfo.additionalUserPrice > 0
                      ? `$${planInfo.additionalUserPrice}/year`
                      : "Custom Pricing"}
                  </span>
                </div>
                {planInfo.additionalUserPrice > 0 && (
                  <div className="flex justify-between text-sm font-semibold border-t border-blue-200 pt-2">
                    <span className="text-blue-900">Total Annual Cost:</span>
                    <span className="text-blue-900">
                      ${totalCost.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Messages */}
          {submitStatus === "success" && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800 font-medium">{submitMessage}</p>
            </div>
          )}

          {submitStatus === "error" && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800 font-medium">{submitMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={usersToAdd <= 0 || isSubmitting}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
