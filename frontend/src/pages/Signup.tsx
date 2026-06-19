import React from 'react';
import { 
  Box, 
  Grid, 
  Typography, 
  Card, 
  CardContent, 
  useMediaQuery, 
  useTheme 
} from '@mui/material';
import { 
  BarChart, 
  Shield, 
  Hub 
} from '@mui/icons-material';
import SignupForm from '../components/auth/SignupForm';

export const Signup: React.FC = () => {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Grid container sx={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Left panel - Branding & Features (hidden on mobile) */}
      {isMdUp && (
        <Grid 
          item 
          xs={12} 
          md={6} 
          sx={{ 
            position: 'relative',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0284c7 100%)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: 8,
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'radial-gradient(circle, rgba(2,132,199,0.15) 0%, transparent 60%)',
              pointerEvents: 'none',
              animation: 'spin 120s linear infinite',
            },
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' }
            }
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1, maxWidth: '540px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
              <Box 
                sx={{ 
                  p: 1.5, 
                  borderRadius: '12px', 
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                <Hub sx={{ fontSize: 32, color: '#38bdf8' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '0.5px' }}>
                ChenaiKit
              </Typography>
            </Box>

            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 800, 
                mb: 3, 
                lineHeight: 1.2,
                background: 'linear-gradient(to right, #ffffff, #93c5fd)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Get started with ChenaiKit
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#94a3b8', mb: 6, fontSize: '18px', lineHeight: 1.6 }}>
              Join us to gain deep analytical insight into wallet transactions, evaluate risk factors, and monitor blockchain metrics in real time.
            </Typography>

            {/* Feature Highlights */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <FeatureItem 
                icon={<BarChart sx={{ color: '#38bdf8' }} />} 
                title="AI Credit Scoring Engine" 
                description="Decentralized creditworthiness evaluation leveraging state-of-the-art predictive neural networks."
              />
              <FeatureItem 
                icon={<Shield sx={{ color: '#34d399' }} />} 
                title="Fraud & Exploit Prevention" 
                description="Real-time transaction tracing and threat vectors parsing for instant vulnerability flagging."
              />
              <FeatureItem 
                icon={<Hub sx={{ color: '#a855f7' }} />} 
                title="Interactive Topology Mapping" 
                description="Interactive node visualizations detailing network state and asset flows across channels."
              />
            </Box>
          </Box>
        </Grid>
      )}

      {/* Right panel - Signup Form */}
      <Grid 
        item 
        xs={12} 
        md={6} 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          p: { xs: 4, sm: 8, md: 6, lg: 8 }
        }}
      >
        <Card 
          elevation={0}
          sx={{ 
            width: '100%', 
            maxWidth: '440px',
            backgroundColor: 'transparent'
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <SignupForm />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => (
  <Box 
    sx={{ 
      display: 'flex', 
      gap: 2.5, 
      p: 2.5, 
      borderRadius: '16px', 
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      transition: 'transform 0.2s ease, border-color 0.2s ease',
      '&:hover': {
        transform: 'translateX(5px)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
      }
    }}
  >
    <Box 
      sx={{ 
        p: 1, 
        height: 'fit-content',
        borderRadius: '10px', 
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: '#f8fafc' }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: '#94a3b8', lineHeight: 1.5 }}>
        {description}
      </Typography>
    </Box>
  </Box>
);

export default Signup;
