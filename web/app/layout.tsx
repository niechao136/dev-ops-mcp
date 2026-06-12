import type { Metadata } from 'next';
import './globals.css';
import RootProvider from '@/providers/root-provider';
import { getServerMode } from '@/utils/cookie';


export const metadata: Metadata = {
  title: 'DevOps MCP - 运维管理平台',
  description: '基于 MCP 协议的 DevOps 运维管理平台',
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialMode = await getServerMode();

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <RootProvider initialMode={initialMode}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
