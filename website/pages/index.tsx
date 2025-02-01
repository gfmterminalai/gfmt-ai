import { Text, Navigation, Card, Button, Grid } from '@agent/ui'

export default function Home() {
  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff' }}>
      <Navigation
        items={[
          { id: 'home', label: 'Home', href: '/' },
          { id: 'about', label: 'About', href: '/about' },
        ]}
      />
      
      <div style={{ padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 24 }}>
          Agent OS
        </Text>
        
        <Grid style={{ gap: 24 }}>
          <Card>
            <Text style={{ marginBottom: 16 }}>
              Welcome to your agent platform powered by terminal aesthetics.
            </Text>
            <Button onClick={() => console.log('Clicked!')}>
              Get Started
            </Button>
          </Card>
          
          <Card>
            <Text style={{ marginBottom: 16 }}>
              Built with modern components and terminal-inspired design.
            </Text>
            <Button onClick={() => console.log('Clicked!')}>
              Learn More
            </Button>
          </Card>
        </Grid>
      </div>
    </div>
  )
} 