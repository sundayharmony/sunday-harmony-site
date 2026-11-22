import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import HomeLower from '@/components/home/HomeLower'
import HomeMotion from '@/components/home/HomeMotion'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Navbar />
      <HomeMotion>
        <main id="main">
          <Hero />
          <HomeLower />
        </main>
      </HomeMotion>
      <Footer />
    </>
  )
}
