/**
 * Home.tsx
 * Homepage for LearnLoop
 * @AshokSaravanan222
 * 04-04-2025
 */
'use client';
import { Box, Button, Container, Typography, IconButton, Grid, Divider } from '@mui/material';
import { styled } from '@mui/material/styles';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useContext } from 'react';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import { useTheme } from '@mui/material/styles';
import { ColorModeContext } from './ColorModeContext';

// Styled components
const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: theme.palette.background.default,
  display: 'flex',
  flexDirection: 'column',
}));

const HeroSection = styled(Box)(({ theme }) => ({
  height: '70vh',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  background: 'linear-gradient(135deg, #3f51b5 0%, #7b1fa2 50%, #e91e63 100%)',
  boxShadow: theme.shadows[5],
  overflow: 'hidden',
  padding: theme.spacing(4),
}));

const HeroContent = styled(Box)({
  position: 'relative',
  zIndex: 2,
  textAlign: 'center',
  padding: '0 20px',
});

const ContentSection = styled(Container)(({ theme }) => ({
  padding: theme.spacing(10, 4),
  maxWidth: '900px',
  color: theme.palette.text.primary,
  flex: 1,
}));

const ScribeButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(45deg, #3f51b5 30%, #7b1fa2 90%)',
  border: 0,
  borderRadius: 50,
  boxShadow: '0 3px 5px 2px rgba(123, 31, 162, .3)',
  color: 'white',
  height: 48,
  padding: '0 30px',
  marginTop: 20,
  '&:hover': {
    background: 'linear-gradient(45deg, #303f9f 30%, #6a1b9a 90%)',
    boxShadow: '0 4px 6px 2px rgba(123, 31, 162, .4)',
  },
}));

const ThemeToggle = styled(Box)({
  position: 'absolute',
  top: 20,
  right: 20,
  zIndex: 10,
});

const Footer = styled(Box)(({ theme }) => ({
  background: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f0f0f0',
  padding: theme.spacing(4),
  color: theme.palette.text.primary,
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const FooterContent = styled(Container)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    gap: theme.spacing(3),
  },
}));

const ContactItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

// Animation styles
const FadeIn = styled(Box)(({ delay = 0 }: { delay?: number }) => ({
  opacity: 0,
  transform: 'translateY(20px)',
  animation: `fadeIn 0.8s ease-out ${delay}s forwards`,
  '@keyframes fadeIn': {
    '0%': {
      opacity: 0,
      transform: 'translateY(20px)',
    },
    '100%': {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
}));

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <PageContainer>
      <ThemeToggle>
        <IconButton onClick={colorMode.toggleColorMode} color="inherit">
          {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </ThemeToggle>
      
      {/* Hero Section */}
      <HeroSection>
        {/* Background Image */}
        <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%',
          opacity: 0.3,
          zIndex: 1
        }}>
          <Image 
            src="/future.webp" 
            alt="Future of Learning" 
            fill 
            style={{ objectFit: 'cover' }} 
            priority
          />
        </Box>
        
        <HeroContent>
          {isLoaded && (
            <>
              <FadeIn delay={0.2}>
                <Typography variant="h1" component="h1" 
                  sx={{ 
                    fontWeight: 700, 
                    fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
                    marginBottom: 2,
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                  }}>
                  LearnLoop
                </Typography>
              </FadeIn>
              <FadeIn delay={0.5}>
                <Typography variant="h5" component="h2" 
                  sx={{ 
                    maxWidth: '800px', 
                    margin: '0 auto',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                  }}>
                  Building a world where students and professors can learn like never before.
                </Typography>
              </FadeIn>
            </>
          )}
        </HeroContent>
      </HeroSection>

      {/* Content Section */}
      <ContentSection>
        {isLoaded && (
          <>
            <FadeIn delay={0.8}>
              <Typography variant="h4" component="h2" gutterBottom 
                sx={{ 
                  color: theme.palette.primary.main, 
                  fontWeight: 600,
                  textAlign: 'center',
                  mb: 4
                }}>
                Our Mission
              </Typography>
            </FadeIn>
            <FadeIn delay={1.0}>
              <Typography variant="body1" sx={{ fontSize: '1.1rem', mb: 3 }}>
                At LearnLoop, we believe that students and professors should have access to world-class AI tools that enable them to focus on personal mastery in learning or teaching, while leaving the rest of the busy work to the AI. Every human being has a right to learn and become great at what they do. It is our duty to make this a reality and widely accessible to the world, as we move closer to AGI. We are immensely grateful for the opportunity to be a part of this mission, and serve the next generation of students who will change the world, and the professors who will guide them to victory.
              </Typography>
            </FadeIn>
            
            <FadeIn delay={1.4} sx={{ textAlign: 'center', mt: 4 }}>
              <Link href="https://www.scribe.it.com" passHref target="_blank" rel="noopener noreferrer">
                <ScribeButton size="large">
                  Discover Scribe
                </ScribeButton>
              </Link>
            </FadeIn>
          </>
        )}
      </ContentSection>

      {/* Footer */}
      <Footer>
        <FooterContent>
          <Box>
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.primary.main }}>
              Contact Us
            </Typography>
            <ContactItem>
              <EmailIcon fontSize="small" color="primary" />
              <Typography variant="body2">contact@learn-loop.org</Typography>
            </ContactItem>
          </Box>
        </FooterContent>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" align="center" sx={{ pt: 1, opacity: 0.7 }}>
          © {new Date().getFullYear()} LearnLoop LLC. All rights reserved.
        </Typography>
      </Footer>
    </PageContainer>
  );
}
