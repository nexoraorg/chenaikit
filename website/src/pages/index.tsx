import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started">
            Get Started - 5min ⏱️
          </Link>
        </div>
      </div>
    </header>
  );
}

function HomepageFeatures() {
  const features = [
    {
      title: '🧠 AI-Powered',
      description: (
        <>
          Built-in AI models for credit scoring, fraud detection, and smart decisioning.
          Train custom models or use our pre-trained ones.
        </>
      ),
    },
    {
      title: '🔗 Blockchain Ready',
      description: (
        <>
          Native Stellar and Soroban integration. Deploy smart contracts with a single command.
          Real-time transaction monitoring included.
        </>
      ),
    },
    {
      title: '⚡ Developer Friendly',
      description: (
        <>
          TypeScript-first SDK with full type safety. Comprehensive documentation,
          examples, and CLI tools to get you started quickly.
        </>
      ),
    },
  ];

  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {features.map((feature, idx) => (
            <div key={idx} className={clsx('col col--4')}>
              <div className="text--center padding-horiz--md">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - AI-Powered Blockchain Toolkit`}
      description="Build AI-powered blockchain applications with ChenAIKit. Credit scoring, fraud detection, and smart contracts made easy.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
