"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useState } from "react";
import TrainingComponent from "./TrainingComponent";

interface TrainingCreationModalProps {
  type?: "required" | "custom";
  onSuccess?: () => void;
}

export default function TrainingCreationModal({
  type = "required",
  onSuccess,
}: TrainingCreationModalProps) {
  const [visible, setVisible] = useState(false);

  const handleSuccess = () => {
    setVisible(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  const handleCancel = () => {
    setVisible(false);
  };

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setVisible(true)}
        size="large"
      >
        {type === "custom"
          ? "Create Custom Training"
          : "Create Required Training"}
      </Button>

      <TrainingComponent
        custom={type === "custom"}
        asModal={true}
        visible={visible}
        onCancel={handleCancel}
        onSuccess={handleSuccess}
        showGuidelines={false}
      />
    </>
  );
}
