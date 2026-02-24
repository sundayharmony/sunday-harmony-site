import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import ProofBar from '@/components/ProofBar'
import Services from '@/components/Services'
import Packages from '@/components/Packages'
import Process from '@/components/Process'
import About from '@/components/About'
import CtaBanner from '@/components/CtaBanner'
import ContactForm from '@/components/ContactForm'
import Footer from '@/components/Footer'
import Divider from '@/components/Divider'

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <ProofBar />
      <Services />
      <Divider />
      <Packages />
      <Divider />
      <Process />
      <Divider />
      <About />
      <CtaBanner />
      <ContactForm />
      <Footer />
    </>
  )
}
