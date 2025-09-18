"use client";

import { Typography } from "antd";

const { Title, Paragraph } = Typography;

export default function EmployeeFeedbackPlaceholder() {
  return (
    <div>
      <Title level={3}>Suggestions</Title>
      <Paragraph>
        Suggestions are now submitted from the Suggestions button in the top
        navigation. This page is no longer used.
      </Paragraph>
    </div>
  );
}
