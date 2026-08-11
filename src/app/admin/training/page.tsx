'use client'

import { useState } from 'react'
import {
  companyInfo,
  services,
  companyProcess,
  roleQualities,
  successTraits,
  workSchedule,
  leadListWorkflow,
  recordKeepingRequirements,
  bestPractices,
  comingSoonResources,
} from '@/lib/training-data'

type Tab = 'company' | 'role' | 'workflow' | 'resources'

export default function TrainingPage() {
  const [tab, setTab] = useState<Tab>('company')
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  const tabs: [Tab, string][] = [
    ['company', 'Company'],
    ['role', 'Your Role'],
    ['workflow', 'How to Work'],
    ['resources', 'Resources'],
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Sales Training Manual</h1>
        <p className="text-sm text-brand-muted">
          Everything you need to know to succeed as a Sunday Harmony sales specialist.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === key
                ? 'bg-accent-soft border border-accent text-accent'
                : 'bg-gray-50 border border-brand-border text-brand-muted hover:text-brand-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <div className="space-y-6">
          <div className="bg-accent-soft border border-accent rounded-xl p-5">
            <div className="text-sm font-bold text-accent mb-2">Welcome to {companyInfo.name}</div>
            <p className="text-sm text-brand-muted leading-relaxed">{companyInfo.mission}</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-brand-text mb-4">Our Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="bg-white border border-brand-border rounded-xl p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{service.icon}</span>
                    <h3 className="text-base font-bold text-brand-text">{service.name}</h3>
                  </div>
                  <p className="text-xs text-brand-muted mb-3 leading-relaxed">{service.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {service.keyPoints.map((point) => (
                      <span
                        key={point}
                        className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] text-brand-dim"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-brand-text mb-4">Our Process</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {companyProcess.map((step) => (
                <div key={step.step} className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: step.color }}
                    >
                      {step.step}
                    </div>
                    <h3 className="text-sm font-bold text-brand-text">{step.title}</h3>
                  </div>
                  <p className="text-xs text-brand-muted leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'role' && (
        <div className="space-y-6">
          <div className="bg-accent-soft border border-accent rounded-xl p-5">
            <div className="text-sm font-bold text-accent mb-2">What We&apos;re Looking For</div>
            <p className="text-sm text-brand-muted leading-relaxed">
              We&apos;re looking for someone who is self-motivated and capable of managing their own schedule
              while consistently meeting KPI targets. Click on each quality below to learn more.
            </p>
          </div>

          <div className="space-y-3">
            {roleQualities.map((quality) => {
              const isExpanded = expandedCard === quality.title
              return (
                <div
                  key={quality.title}
                  className={`rounded-xl border transition-all ${
                    isExpanded ? 'bg-gray-50 border-accent' : 'bg-white border-brand-border'
                  }`}
                >
                  <button
                    onClick={() => setExpandedCard(isExpanded ? null : quality.title)}
                    className="w-full p-4 flex items-start gap-3 text-left"
                  >
                    <span className="text-2xl">{quality.icon}</span>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-brand-text">{quality.title}</h3>
                      <p className="text-xs text-brand-muted mt-1">{quality.description}</p>
                    </div>
                    <span
                      className={`text-brand-dim text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      ▾
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-200 pt-3 ml-11">
                      <ul className="space-y-2">
                        {quality.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-brand-muted">
                            <span className="text-accent mt-0.5">•</span>
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-brand-text mb-4">Success Traits Checklist</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {successTraits.map((trait, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">✓</span>
                  <span className="text-xs text-brand-muted">{trait}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'workflow' && (
        <div className="space-y-6">
          <div className="bg-accent-soft border border-accent rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg">🕐</span>
              <div className="text-sm font-bold text-accent">Working Hours</div>
            </div>
            <p className="text-sm text-brand-muted">
              <strong>{workSchedule.hours}</strong> ({workSchedule.timezone}), {workSchedule.days}
            </p>
            <p className="text-xs text-brand-dim mt-2">{workSchedule.note}</p>
          </div>

          <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-brand-text mb-3">Lead List Overview</h3>
            <p className="text-sm text-brand-muted mb-4">{leadListWorkflow.overview}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leadListWorkflow.responsibilities.map((item) => (
                <div key={item.title} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{item.icon}</span>
                    <h4 className="text-sm font-bold text-brand-text">{item.title}</h4>
                  </div>
                  <p className="text-xs text-brand-muted">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-brand-text mb-4">Record Keeping Requirements</h3>
            <div className="space-y-3">
              {recordKeepingRequirements.map((req) => (
                <div key={req.requirement} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-brand-text">{req.requirement}</div>
                    <p className="text-xs text-brand-muted mt-0.5">{req.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-base font-bold text-brand-text mb-4">Best Practices</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bestPractices.map((practice, i) => (
                <div key={i} className="bg-white border border-brand-border rounded-xl p-4 shadow-sm">
                  <div className="text-[10px] font-bold uppercase text-accent mb-2">Tip #{i + 1}</div>
                  <h4 className="text-sm font-bold text-brand-text mb-2">{practice.title}</h4>
                  <p className="text-xs text-brand-muted leading-relaxed">{practice.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'resources' && (
        <div className="space-y-6">
          <div className="bg-accent-soft border border-accent rounded-xl p-5">
            <div className="text-sm font-bold text-accent mb-2">Coming Soon</div>
            <p className="text-sm text-brand-muted">
              Additional resources are being prepared and will be available here shortly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comingSoonResources.map((resource) => (
              <div
                key={resource.title}
                className="bg-white border border-brand-border rounded-xl p-5 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[10px] font-semibold text-brand-dim">
                    Coming Soon
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl opacity-50">{resource.icon}</span>
                  <h3 className="text-base font-bold text-brand-dim">{resource.title}</h3>
                </div>
                <p className="text-xs text-brand-dim leading-relaxed">{resource.description}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Need Help Now?</div>
            <p className="text-sm text-brand-muted">
              If you have questions about payment processing or website navigation before these guides are
              available, please reach out to your manager or use the Team Chat feature.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
