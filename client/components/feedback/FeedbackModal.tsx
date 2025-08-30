"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "@/lib/toast";
import { Button, Form, Input, Modal, Space } from "antd";
import { useState } from "react";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

const { TextArea } = Input;

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (values: { feedback: string }) => {
    if (!user?.id) {
      toast.error("You must be logged in to submit feedback");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.id,
          feedback_text: values.feedback,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      toast.success(
        "Thank you for your feedback! We appreciate you taking the time to help us improve LearnLoop."
      );
      form.resetFields();
      onClose();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="Share Your Feedback"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={500}
      destroyOnClose
      styles={{
        header: {
          borderBottom: "1px solid #f0f0f0",
          marginBottom: "24px",
        },
      }}
    >
      <div style={{ marginBottom: "16px" }}>
        <p style={{ margin: 0, color: "#595959", fontSize: "14px" }}>
          Help us improve LearnLoop by sharing your thoughts, suggestions, or
          reporting issues.
        </p>
      </div>

      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item
          name="feedback"
          label="Your Feedback"
          rules={[
            { required: true, message: "Please enter your feedback" },
            {
              min: 10,
              message: "Please provide at least 10 characters of feedback",
            },
          ]}
        >
          <TextArea
            rows={6}
            placeholder="Share your thoughts, suggestions, or report any issues you've encountered..."
            style={{
              resize: "none",
            }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                background: "#1890ff",
                borderColor: "#1890ff",
              }}
            >
              Submit Feedback
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
