"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  useCreatePersona,
  usePersonas,
  useUpdatePersona,
} from "@/lib/api/hooks/usePersonas";
import { useCreateProfile } from "@/lib/api/hooks/useProfiles";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SaveOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function ProfilePage() {
  const { effectiveProfile } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();
  const [isEditing] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  // Get user personas
  const { data: personas, isLoading, error } = usePersonas(effectiveProfile?.id);
  const createProfile = useCreateProfile();
  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona(personas?.[0]?.id || "");

  // Initialize form with persona data
  useEffect(() => {
    if (personas && personas.length > 0) {
      const persona = personas[0];
      form.setFieldsValue({
        name: persona.name,
        description: persona.description,
        position: persona.position,
        level: persona.level,
      });
    }
  }, [personas, form]);

  const handleCreateProfile = async () => {
    try {
      // Create profile first
      const profile = await createProfile.mutateAsync({
        id: effectiveProfile?.id,
        name: effectiveProfile?.name || "User Profile",
      });

      // Create persona for the profile
      await createPersona.mutateAsync({
        profile_id: profile.id,
        name: effectiveProfile?.name || "User",
        description: "Please update your profile information",
        position: "",
        level: "junior",
      });

      messageApi.success(
        "Profile created successfully! You can now edit your information."
      );
    } catch (error) {
      console.error("Failed to create profile:", error);
      messageApi.error("Failed to create profile. Please try again.");
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updatePersona.mutateAsync({
        name: values.name,
        description: values.description,
        position: values.position,
        level: values.level,
      });

      messageApi.success("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile:", error);
      messageApi.error("Failed to update profile. Please try again.");
    }
  };

  if (isLoading || createProfile.isPending || createPersona.isPending) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "50vh",
        }}
      >
        <Text>Loading profile...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "50vh",
        }}
      >
        <Text type="danger">Error loading profile. Please try again.</Text>
      </div>
    );
  }

  // If no personas exist, show create profile option
  if (!personas || personas.length === 0) {
    return (
      <div style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto" }}>
        {contextHolder}

        <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0, marginTop: "8px" }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => router.back()}
              style={{ padding: "8px 16px", fontSize: "16px" }}
            >
              Back
            </Button>
          </div>

          <div style={{ flex: 1 }}>
            <Card>
              <div style={{ marginBottom: "24px" }}>
                <Title
                  level={2}
                  style={{
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <UserOutlined />
                  Profile
                </Title>
                <Text type="secondary">Create your profile to get started</Text>
              </div>

              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: "16px",
                    marginBottom: "24px",
                    display: "block",
                  }}
                >
                  You don&apos;t have a profile yet. Create one to start
                  personalizing your experience.
                </Text>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleCreateProfile}
                  loading={createProfile.isPending || createPersona.isPending}
                  icon={<PlusOutlined />}
                >
                  Create Profile
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto" }}>
      {contextHolder}

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0, marginTop: "8px" }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
            style={{ padding: "8px 16px", fontSize: "16px" }}
          >
            Back
          </Button>
        </div>

        <div style={{ flex: 1 }}>
          <Card>
            <div style={{ marginBottom: "24px" }}>
              <Title
                level={2}
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <UserOutlined />
                Profile
              </Title>
              <Text type="secondary">
                View and edit your persona information. This helps the AI
                generate better scenarios.
              </Text>
            </div>

            <Form
              form={form}
              layout="vertical"
              disabled={!isEditing}
              style={{ maxWidth: "600px" }}
            >
              <Form.Item
                label="Name"
                name="name"
                rules={[{ required: true, message: "Please enter your name" }]}
              >
                <Input placeholder="Enter your name" />
              </Form.Item>

              <Form.Item
                label="Position"
                name="position"
                rules={[
                  { required: true, message: "Please enter your position" },
                ]}
              >
                <Input placeholder="Enter your position/title" />
              </Form.Item>

              <Form.Item
                label="Level"
                name="level"
                rules={[
                  { required: true, message: "Please select your level" },
                ]}
              >
                <Select placeholder="Select your level">
                  <Option value="junior">Junior</Option>
                  <Option value="mid">Mid-level</Option>
                  <Option value="senior">Senior</Option>
                  <Option value="executive">Executive</Option>
                </Select>
              </Form.Item>

              <Form.Item label="Description" name="description">
                <TextArea
                  rows={4}
                  placeholder="Enter a description about yourself, your role, and your experience"
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    onClick={handleSave}
                    loading={updatePersona.isPending}
                    icon={<SaveOutlined />}
                  >
                    Save Changes
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  );
}
