"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  useCreatePersona,
  usePersonas,
  useUpdatePersona,
} from "@/lib/api/hooks/usePersonas";
import {
  useCreateProfile,
  useUpdateProfile,
} from "@/lib/api/hooks/useProfiles";
import { SaveOutlined, UserOutlined } from "@ant-design/icons";
import {
  Button,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Typography,
  message,
} from "antd";
import { useEffect, useState } from "react";

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks for profile and persona management
  const { data: personas } = usePersonas(user?.id);
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile(user?.id || "");
  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona(personas?.[0]?.id || "");

  // Note: We don't need to check viewed_intro here since the modal only shows when it's false

  useEffect(() => {
    if (open) {
      // Pre-fill form with user data if available
      const fullName = user?.user_metadata?.full_name || "";
      const firstName = fullName.split(" ")[0] || user?.email || "";

      form.setFieldsValue({
        name: firstName,
        position: "",
        level: "senior",
        description: "",
      });
    }
  }, [open, user, form]);

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      const values = await form.validateFields();

      // If no personas exist, create profile and persona
      if (!personas || personas.length === 0) {
        // Create profile first
        const profile = await createProfile.mutateAsync({
          id: user?.id,
          name: values.name,
          viewed_intro: true,
        });

        // Create persona for the profile
        await createPersona.mutateAsync({
          profile_id: profile.id,
          name: values.name,
          description: values.description,
          position: values.position,
          level: values.level,
        });
      } else {
        // Update existing profile to mark viewed_intro as true
        await updateProfile.mutateAsync({
          viewed_intro: true,
        });

        // Update existing persona
        await updatePersona.mutateAsync({
          name: values.name,
          description: values.description,
          position: values.position,
          level: values.level,
        });
      }

      messageApi.success(
        "Thank you! Your profile has been set up successfully."
      );
      onClose();
    } catch (error) {
      console.error("Failed to save profile:", error);
      messageApi.error("Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <UserOutlined />
            <span>Welcome to LearnLoop!</span>
          </div>
        }
        open={open}
        onCancel={undefined}
        footer={null}
        width={600}
        centered
        maskClosable={false}
        closable={false}
      >
        <div style={{ padding: "16px 0" }}>
          <Text
            type="secondary"
            style={{ marginBottom: "24px", display: "block" }}
          >
            Help us create better AI scenarios by sharing your role and
            experience. You can always edit this information later in your
            profile page.
          </Text>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            style={{ marginTop: "16px" }}
          >
            {/* Row 1: Name */}
            <Form.Item
              label="Name"
              name="name"
              rules={[{ required: true, message: "Please enter your name" }]}
            >
              <Input placeholder="Enter your full name" size="large" />
            </Form.Item>

            {/* Row 2: Position and Level (half and half) */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Position"
                  name="position"
                  rules={[
                    { required: true, message: "Please enter your position" },
                  ]}
                >
                  <Input placeholder="e.g., Software Engineer" size="large" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Level"
                  name="level"
                  rules={[
                    { required: true, message: "Please select your level" },
                  ]}
                >
                  <Select placeholder="Select your level" size="large">
                    <Option value="junior">Junior</Option>
                    <Option value="mid">Mid-level</Option>
                    <Option value="senior">Senior</Option>
                    <Option value="executive">Executive</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Row 3: Description */}
            <Form.Item label="Description" name="description">
              <TextArea
                rows={4}
                placeholder="Tell us about yourself, your role, and your experience..."
                size="large"
              />
            </Form.Item>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "24px",
                paddingTop: "16px",
                borderTop: "1px solid #f0f0f0",
              }}
            >
              <Button
                type="primary"
                htmlType="submit"
                loading={isSubmitting}
                icon={<SaveOutlined />}
                size="large"
              >
                Save & Continue
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </>
  );
}
