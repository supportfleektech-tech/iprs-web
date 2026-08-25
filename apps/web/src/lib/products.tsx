import type { ReactNode } from 'react';
import Link from 'next/link';

export interface ProductInfo {
  slug: string;
  title: string;
  short: string;
  description: string;
  inputLabel: string;
  inputExample: string;
  outputs: string[];
  features: string[];
}

export const PRODUCTS: ProductInfo[] = [
  {
    slug: 'iprs-id',
    title: 'IPRS ID Verification',
    short: 'Instant National ID validation against the government registry.',
    description:
      'Confirm that customers are who they say they are by validating their National ID against the Integrated Population Registration System in real time.',
    inputLabel: 'National ID Number',
    inputExample: '12345678',
    outputs: ['Full Name', 'Date of Birth', 'Gender', 'Serial Number', 'Place of Birth', 'Citizenship', 'Alive Status'],
    features: [
      'Real-time verification against IPRS records',
      'Instant name and ID validation',
      'Serial number verification',
      'Government-backed accuracy',
    ],
  },
  {
    slug: 'kra-pin',
    title: 'KRA PIN Checker',
    short: 'Validate KRA PINs and tax compliance status.',
    description:
      'Verify the authenticity of a customer’s KRA PIN and check their tax registration status before onboarding or disbursing loans.',
    inputLabel: 'KRA PIN',
    inputExample: 'A012345678Z',
    outputs: ['PIN Validity', 'Taxpayer Name', 'Status', 'Tax Obligation'],
    features: [
      'KRA PIN validation and authenticity check',
      'Tax compliance status',
      'Works with ID number as fallback lookup',
      'Registration status confirmation',
    ],
  },
  {
    slug: 'hakikisha',
    title: 'Hakikisha / Phone Check',
    short: 'Phone ownership and M-Pesa KYC matching.',
    description:
      'Know who owns a phone number before you lend to it. Retrieve registered owner names and confirm M-Pesa registration status.',
    inputLabel: 'Phone Number or National ID',
    inputExample: '0712345678',
    outputs: ['Registered Owner', 'ID Number', 'Registered Numbers', 'M-Pesa Status'],
    features: [
      'Owner name retrieval across networks',
      'All numbers linked to a National ID',
      'M-Pesa KYC match',
      'Multiple network support',
    ],
  },
  {
    slug: 'sim-swap',
    title: 'SIM-swap Detection',
    short: 'Detect recent SIM changes before fraud happens.',
    description:
      'Protect OTP and mobile-money flows from SIM-swap fraud with real-time swap detection and risk scoring.',
    inputLabel: 'Phone Number',
    inputExample: '+254712345678',
    outputs: ['Last Swap Date', 'Days Since Swap', 'Risk Level'],
    features: [
      'Real-time SIM swap detection',
      'Historical swap tracking',
      'Risk level classification',
      'Ideal pre-disbursement guard',
    ],
  },
];
