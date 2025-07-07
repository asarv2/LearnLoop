/**
 * app/page.tsx
 * Landing page for LearnLoop - AI Interview Training Platform
 * Fixed video display issues
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
        </Container>
      </Section>

      {/* Step 1: Upload Resume */}
      <Section py="7">
        
        <Container size="4">
          <Grid columns={{ initial: '1', lg: '2' }} gap="8" align="center">
            <Box>
              <Flex align="center" gap="4" mb="4">
                <Box style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--blue-9) 0%, var(--blue-11) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}>
                  1
                </Box>
                <Heading size="6" weight="bold">Upload Resume</Heading>
              </Flex>
              <Text size="4" color="gray" style={{ lineHeight: '1.6' }}>
                Start by uploading the candidate's resume and configuring the interview settings. 
                Our AI analyzes the resume content to create a realistic candidate persona that 
                matches their background, experience, and skills. You can also specify the 
                interview type and focus areas to tailor the simulation to your needs.
              </Text>
            </Box>
            <Box style={{ 
              position: 'relative',
              aspectRatio: '16/9',
              borderRadius: '15px',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
            }}>
              <video 
                width="100%" 
                height="100%" 
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                style={{ 
                  objectFit: 'cover',
                  display: 'block',
                  imageRendering: 'crisp-edges',
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden'
                }}
                onError={(e) => {
                  console.error('Video error:', e);
                }}
              >
                <source src="/videos/FirstScreen.mp4" type="video/mp4" />
                <source src="/videos/FirstScreen.webm" type="video/webm" />
                Your browser doesn't support video playback.
              </video>
            </Box>
          </Grid>
        </Container>
      </Section>

      {/* Step 2: Practice Interview */}
      <Section py="7" style={{ background: 'white' }}>
        <Container size="4">
          <Grid columns={{ initial: '1', lg: '2' }} gap="8" align="center">
            <Box style={{ 
              position: 'relative',
              aspectRatio: '16/9',
              borderRadius: '15px',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
            }}>
              <video 
                width="100%" 
                height="100%" 
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                style={{ 
                  objectFit: 'cover',
                  display: 'block',
                  imageRendering: 'crisp-edges',
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden'
                }}
                onError={(e) => {
                  console.error('Video error:', e);
                }}
              >
                <source src="/videos/FirstScreen.mp4" type="video/mp4" />
                <source src="/videos/FirstScreen.webm" type="video/webm" />
                Your browser doesn't support video playback.
              </video>
            </Box>
            <Box>
              <Flex align="center" gap="4" mb="4">
                <Box style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--green-9) 0%, var(--green-11) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}>
                  2
                </Box>
                <Heading size="6" weight="bold">Practice Interview</Heading>
              </Flex>
              <Text size="4" color="gray" style={{ lineHeight: '1.6' }}>
                Conduct a natural conversation with our AI candidate that responds authentically 
                based on their resume data. Ask questions, explore their experience, and practice 
                your interviewing techniques in a realistic simulation. The AI candidate will 
                respond as if they were the real person, providing detailed answers about their background.
              </Text>
            </Box>
          </Grid>
        </Container>
      </Section>

      {/* Step 3: Get Feedback */}
      <Section py="7">
        <Container size="4">
          <Grid columns={{ initial: '1', lg: '2' }} gap="8" align="center">
            <Box>
              <Flex align="center" gap="4" mb="4">
                <Box style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--purple-9) 0%, var(--purple-11) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}>
                  3
                </Box>
                <Heading size="6" weight="bold">Get Feedback</Heading>
              </Flex>
              <Text size="4" color="gray" style={{ lineHeight: '1.6' }}>
                After your interview session, receive comprehensive feedback on your performance. 
                Our AI analyzes your questioning techniques, identifies what you did well, highlights 
                missteps with specific alternatives, and reveals subtle green and red flags you should 
                have noticed about the candidate. Learn to become a more effective interviewer.
              </Text>
            </Box>
            <Box style={{ 
              position: 'relative',
              aspectRatio: '16/9',
              borderRadius: '15px',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
            }}>
              <video 
                width="100%" 
                height="100%" 
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                style={{ 
                  objectFit: 'cover',
                  display: 'block',
                  imageRendering: 'crisp-edges',
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden'
                }}
                onError={(e) => {
                  console.error('Video error:', e);
                }}
              >
                <source src="/videos/FirstScreen.mp4" type="video/mp4" />
                <source src="/videos/FirstScreen.webm" type="video/webm" />
                Your browser doesn't support video playback.
              </video>
            </Box>
          </Grid>
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
      <Box py="6" style={{ background: 'white', color: 'var(--gray-11)' }}>
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
              <Text size="3" weight="medium" style={{ color: 'blue' }}>
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