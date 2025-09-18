"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "@/lib/toast";
import { Button, Form, Input, Modal, Space } from "antd";
import { useState } from "react";

interface SuggestionsModalProps {
  open: boolean;
  onClose: () => void;
}

const { TextArea } = Input;

export default function SuggestionsModal({
  open,
  onClose,
}: SuggestionsModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (values: { suggestion: string }) => {
    if (!user?.id) {
      toast.error("You must be logged in to submit a suggestion");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/v1/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          suggestion_text: values.suggestion,
        }),
      });
      if (!response.ok) throw new Error("Failed to submit suggestion");
      toast.success("Thanks for your suggestion!");
      form.resetFields();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit suggestion. Please try again.");
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
      title="Submit a Suggestion"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={500}
      destroyOnHidden
    >
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, color: "#595959", fontSize: 14 }}>
          Have an idea or found something we should improve? Submit a suggestion
          to the team.
        </p>
      </div>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="suggestion"
          label="Your Suggestion"
          rules={[
            { required: true, message: "Please enter your suggestion" },
            { min: 10, message: "Please provide at least 10 characters" },
          ]}
        >
          <TextArea
            rows={6}
            placeholder="Describe your suggestion or improvement idea..."
            style={{ resize: "none" }}
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Submit Suggestion
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
