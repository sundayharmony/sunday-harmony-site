import Navbar from '@/components/Navbar'
import HomeDesign from '@/components/home/HomeDesign'
import HomeMotion from '@/components/home/HomeMotion'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Navbar />
      <HomeMotion>
        <main id="main">
          <HomeDesign />
        </main>
      </HomeMotion>
      <Footer />
    </>
  )
}
