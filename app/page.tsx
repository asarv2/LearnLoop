/**
 * app/page.tsx
 * Landing page for LearnLoop - AI Interview Training Platform
 * @AshokSaravanan222 & @siladiea
 */

"use client";

import { 
  Box, 
  Flex, 
  Heading, 
  Text, 
  Button,
  Card,
  Container,
  Grid,
  Section
} from '@radix-ui/themes';
import { 
  ChatBubbleIcon, 
  CheckIcon, 
  PersonIcon,
  TargetIcon,
  LightningBoltIcon,
  ArrowRightIcon
} from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/interview');
  };

  const handleBookDemo = () => {
    // TODO: Implement demo booking functionality
    console.log('Book demo clicked');
  };

  return (
    <Box style={{ minHeight: '100vh', background: 'var(--gray-1)' }}>
      {/* Header */}
      <Box style={{ 
        background: 'white', 
        borderBottom: '1px solid var(--gray-6)',
        position: 'sticky',
        top: '0',
        zIndex: '100'
      }}>
        <Container size="4">
          <Flex justify="between" align="center" py="4">
            <Flex align="center" gap="3">
              <Box style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--blue-9) 0%, var(--purple-9) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text size="4" weight="bold" style={{ color: 'white' }}>L</Text>
              </Box>
              <Heading size="6" weight="bold">
                LearnLoop
              </Heading>
            </Flex>
            <Flex gap="3" align="center">
              <a href="https://calendly.com/siladiea2005/demo-meeting" target="_blank">
                <Button variant="outline" onClick={handleBookDemo}>
                  Book Demo
                </Button>
              </a>
              <Button onClick={handleGetStarted}>
                Get Started
                <ArrowRightIcon />
              </Button>
            </Flex>
          </Flex>
        </Container>
      </Box>

      {/* Hero Section */}
      <Section py="9">
        <Container size="4">
          <Box style={{ textAlign: 'center' }} mb="8">
            <Heading size="9" weight="bold" mb="4" style={{ 
              background: 'linear-gradient(135deg, var(--blue-11) 0%, var(--purple-11) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: '1.1'
            }}>
              Master Your Interview Skills with AI-Powered Training
            </Heading>
            <Text size="5" color="gray" mb="6" style={{ 
              lineHeight: '1.6', 
              maxWidth: '700px', 
              margin: '0 auto 32px auto' 
            }}>
              Practice interviewing candidates with our advanced AI simulation. Get detailed feedback, 
              improve your questioning techniques, and become a more effective interviewer.
            </Text>
          </Box>

          {/* Hero Visual */}
          <Box style={{ 
            maxWidth: '900px',
            margin: '0 auto',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
            background: 'white',
            border: '1px solid var(--gray-6)'
          }}>
            <Box p="6" style={{ background: 'var(--gray-2)' }}>
              <Flex gap="2" mb="4">
                <Box style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--red-9)' }} />
                <Box style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--yellow-9)' }} />
                <Box style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--green-9)' }} />
              </Flex>
              <Card style={{ background: 'white', padding: '24px' }}>
                <Flex direction="column" gap="4">
                  <Flex align="center" gap="3">
                    <Box style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'var(--blue-3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <PersonIcon color="var(--blue-11)" />
                    </Box>
                    <Box>
                      <Text weight="bold">AI Candidate</Text>
                      <Text size="2" color="gray">Software Engineer</Text>
                    </Box>
                  </Flex>
                  <Box style={{ 
                    background: 'var(--gray-2)', 
                    padding: '12px 16px', 
                    borderRadius: '12px',
                    borderTopLeftRadius: '4px'
                  }}>
                    <Text size="2">
                      "I have 5 years of experience in full-stack development, particularly with React and Node.js. 
                      I'm passionate about creating scalable applications and have led several successful projects..."
                    </Text>
                  </Box>
                  <Flex gap="2">
                    <Button size="1" variant="soft">Ask follow-up</Button>
                    <Button size="1" variant="soft">Technical question</Button>
                    <Button size="1" variant="soft">Behavioral question</Button>
                  </Flex>
                </Flex>
              </Card>
            </Box>
          </Box>
        </Container>
      </Section>

      {/* Features Section */}
      <Section py="9" style={{ background: 'white' }}>
        <Container size="4">
          <Box style={{ textAlign: 'center' }} mb="8">
            <Heading size="7" weight="bold" mb="4">
              Why Choose LearnLoop?
            </Heading>
            <Text size="4" color="gray" style={{ maxWidth: '600px', margin: '0 auto' }}>
              Our AI-powered platform provides comprehensive interview training that adapts to your needs
            </Text>
          </Box>
          
          <Grid columns={{ initial: '1', md: '3' }} gap="6">
            <Card style={{ padding: '32px', textAlign: 'center', border: '1px solid var(--gray-6)' }}>
              <Box style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--blue-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <TargetIcon width="24" height="24" color="var(--blue-11)" />
              </Box>
              <Heading size="5" mb="3">Realistic AI Candidates</Heading>
              <Text color="gray">
                Practice with AI candidates that respond naturally based on real resume data and job requirements
              </Text>
            </Card>

            <Card style={{ padding: '32px', textAlign: 'center', border: '1px solid var(--gray-6)' }}>
              <Box style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--green-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <ChatBubbleIcon width="24" height="24" color="var(--green-11)" />
              </Box>
              <Heading size="5" mb="3">Detailed Feedback</Heading>
              <Text color="gray">
                Receive comprehensive feedback on your questioning techniques, communication style, and areas for improvement
              </Text>
            </Card>

            <Card style={{ padding: '32px', textAlign: 'center', border: '1px solid var(--gray-6)' }}>
              <Box style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--purple-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <LightningBoltIcon width="24" height="24" color="var(--purple-11)" />
              </Box>
              <Heading size="5" mb="3">Instant Practice</Heading>
              <Text color="gray">
                Start practicing immediately with any resume. No scheduling, no waiting - just upload and begin training
              </Text>
            </Card>
          </Grid>
        </Container>
      </Section>

      {/* How It Works Section */}
      <Section py="9">
        <Container size="4">
          <Box style={{ textAlign: 'center' }} mb="8">
            <Heading size="7" weight="bold" mb="4">
              How It Works
            </Heading>
            <Text size="4" color="gray" style={{ maxWidth: '600px', margin: '0 auto' }}>
              Get started with AI interview training in just three simple steps
            </Text>
          </Box>

          <Grid columns={{ initial: '1', md: '3' }} gap="8">
            <Flex direction="column" align="center" style={{ textAlign: 'center' }}>
              <Box style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--blue-9) 0%, var(--blue-11) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 0 24px',
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold'
              }}>
                1
              </Box>
              <Heading size="5" mb="3">Upload Resume</Heading>
              <Text color="gray" style={{ lineHeight: '1.6' }}>
                Upload the candidate's resume and specify the interview type to create a realistic simulation
              </Text>
            </Flex>

            <Flex direction="column" align="center" style={{ textAlign: 'center' }}>
              <Box style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--green-9) 0%, var(--green-11) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 0 24px',
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold'
              }}>
                2
              </Box>
              <Heading size="5" mb="3">Practice Interview</Heading>
              <Text color="gray" style={{ lineHeight: '1.6' }}>
                Conduct a natural conversation with our AI candidate that responds based on the resume data
              </Text>
            </Flex>

            <Flex direction="column" align="center" style={{ textAlign: 'center' }}>
              <Box style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--purple-9) 0%, var(--purple-11) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 0 24px',
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold'
              }}>
                3
              </Box>
              <Heading size="5" mb="3">Get Feedback</Heading>
              <Text color="gray" style={{ lineHeight: '1.6' }}>
                Receive detailed feedback on your performance with specific suggestions for improvement
              </Text>
            </Flex>
          </Grid>
        </Container>
      </Section>

      {/* Benefits Section */}
      <Section py="9" style={{ background: 'white' }}>
        <Container size="4">
                    <Grid columns={{ initial: '1', lg: '2' }} gap="8" align="center">
            <Box>
              <Heading size="7" weight="bold" mb="4">
                Improve Your Interview Success Rate
              </Heading>
              <Text size="4" color="gray" mb="6" style={{ lineHeight: '1.6' }}>
                LearnLoop helps hiring managers, team leads, and recruiters develop better interviewing skills, 
                leading to more effective candidate assessments and better hiring decisions.
              </Text>
            </Box>

            <Box>
              <Flex direction="column" gap="4">
                <Flex align="center" gap="3">
                  <CheckIcon color="var(--green-11)" />
                  <Text size="4">Practice with unlimited AI candidates</Text>
                </Flex>
                <Flex align="center" gap="3">
                  <CheckIcon color="var(--green-11)" />
                  <Text size="4">Get feedback on questioning techniques</Text>
                </Flex>
                <Flex align="center" gap="3">
                  <CheckIcon color="var(--green-11)" />
                  <Text size="4">Learn to identify key candidate qualities</Text>
                </Flex>
                <Flex align="center" gap="3">
                  <CheckIcon color="var(--green-11)" />
                  <Text size="4">Improve communication and listening skills</Text>
                </Flex>
              </Flex>
            </Box>
          </Grid>
        </Container>
      </Section>

      

      {/* Footer */}
      <Box py="6" style={{ background: 'var(--gray-12)', color: 'var(--gray-11)' }}>
        <Container size="4">
          <Flex justify="between" align="center">
            <Flex align="center" gap="3">
              <Box style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, var(--blue-9) 0%, var(--purple-9) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text size="3" weight="bold" style={{ color: 'white' }}>L</Text>
              </Box>
              <Text size="3" weight="medium" style={{ color: 'white' }}>
                LearnLoop
              </Text>
            </Flex>
            <Text size="2" color="blue">
              © 2025 LearnLoop. All rights reserved.
            </Text>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
}
