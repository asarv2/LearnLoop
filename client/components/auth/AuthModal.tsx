"use client";

import { toast } from "@/lib/toast";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import {
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Form, Input, Modal, Typography } from "antd";
import { useState } from "react";

const { Title, Text, Link } = Typography;

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
}

export default function AuthModal({
  open,
  onClose,
  mode,
  onModeChange,
}: AuthModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseBrowser();

  const handleSubmit = async (values: {
    email: string;
    password: string;
    fullName?: string;
    companyCode?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        // Validate company code first
        if (!values.companyCode) {
          throw new Error("Company code is required for signup");
        }

        const codeResponse = await fetch("/api/v1/validate-company-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code: values.companyCode }),
        });

        const codeResult = await codeResponse.json();

        if (!codeResponse.ok) {
          throw new Error(codeResult.error || "Invalid company code");
        }

        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: {
              full_name: values.fullName,
              company_code: values.companyCode,
              company_name: codeResult.companyName,
            },
          },
        });

        if (error) throw error;

        // For signup, let AuthProvider handle redirect based on role
        if (data.user) {
          toast.success("Account created successfully!");
          onClose();
          // AuthProvider will handle redirect based on user's role
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (error) throw error;
        toast.success("Welcome back!");
        onClose();
        // AuthProvider will handle redirect based on user's role
      }
    } catch (error: unknown) {
      console.error("Auth error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred during authentication"
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    form.resetFields();
    setError(null);
  };

  const handleModeSwitch = (newMode: "login" | "signup") => {
    resetForm();
    onModeChange(newMode);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={400}
      centered
      destroyOnHidden
    >
      <div style={{ padding: "20px 0" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: "white",
              fontSize: "20px",
              fontWeight: "bold",
            }}
          >
            L
          </div>
          <Title level={3} style={{ margin: 0 }}>
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </Title>
          <Text type="secondary">
            {mode === "login"
              ? "Sign in to continue your training"
              : "Start your training journey"}
          </Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            style={{ marginBottom: "16px" }}
            closable
            onClose={() => setError(null)}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          {mode === "signup" && (
            <Form.Item
              name="fullName"
              label="Full Name"
              rules={[
                { required: true, message: "Please enter your full name" },
                { min: 2, message: "Name must be at least 2 characters" },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Enter your full name"
              />
            </Form.Item>
          )}

          {mode === "signup" && (
            <Form.Item
              name="companyCode"
              label="Company Code"
              rules={[
                { required: true, message: "Please enter your company code" },
                {
                  min: 3,
                  message: "Company code must be at least 3 characters",
                },
              ]}
            >
              <Input
                prefix={<SafetyCertificateOutlined />}
                placeholder="Enter your company code"
                style={{ textTransform: "uppercase" }}
                onChange={(e) => {
                  const upperValue = e.target.value.toUpperCase();
                  form.setFieldValue("companyCode", upperValue);
                }}
              />
            </Form.Item>
          )}

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Please enter your email" },
              { type: "email", message: "Please enter a valid email" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Enter your email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: "Please enter your password" },
              { min: 6, message: "Password must be at least 6 characters" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter your password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: "16px" }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: "48px", fontSize: "16px" }}
            >
              {mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </Form.Item>
        </Form>

        {/* Google OAuth temporarily disabled - configure in Supabase Dashboard */}
        {/* 
          <Divider style={{ margin: '16px 0' }}>
            <Text type="secondary">or</Text>
          </Divider>

          <Button 
            onClick={handleGoogleSignIn}
            loading={loading}
            block
            style={{ 
              height: '48px', 
              fontSize: '16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
          */}

        <div style={{ textAlign: "center" }}>
          <Text type="secondary">
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
          </Text>{" "}
          <Link
            onClick={() =>
              handleModeSwitch(mode === "login" ? "signup" : "login")
            }
            style={{ fontWeight: "bold" }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </Link>
        </div>
      </div>
    </Modal>
  );
}
