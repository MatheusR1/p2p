"use client"

import { useState, useRef, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Send, Upload, Download, Copy, Check, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function P2PConnection() {
  const { toast } = useToast()
  const [isConnected, setIsConnected] = useState(false)
  const [offer, setOffer] = useState("")
  const [answer, setAnswer] = useState("")
  const [guestOffer, setGuestOffer] = useState("")
  const [guestAnswer, setGuestAnswer] = useState("")
  const [message, setMessage] = useState("")
  const [chatMessages, setChatMessages] = useState<string[]>([])
  const [downloadUrl, setDownloadUrl] = useState("")
  const [downloadFileName, setDownloadFileName] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [transferProgress, setTransferProgress] = useState(0)
  const [isTransferring, setIsTransferring] = useState(false)

  const peerRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RTCDataChannel | null>(null)
  const fileChunksRef = useRef<ArrayBuffer[]>([])
  const fileNameRef = useRef("")
  const fileSizeRef = useRef(0)
  const receivedSizeRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  const configureChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => {
      addChatMessage("🔗 Conectado!")
      setIsConnected(true)
      setIsLoading(false)
    }

    channel.onclose = () => {
      addChatMessage("🔌 Desconectado")
      setIsConnected(false)
    }

    channel.onmessage = (e) => {
      if (typeof e.data === "string") {
        if (e.data.startsWith("FILE_META:")) {
          const meta = JSON.parse(e.data.replace("FILE_META:", ""))
          fileNameRef.current = meta.name
          fileSizeRef.current = meta.size
          receivedSizeRef.current = 0
          fileChunksRef.current = []
          addChatMessage(`⬇️ Recebendo arquivo: ${meta.name} (${formatFileSize(meta.size)})`)
          setIsTransferring(true)
        } else if (e.data === "FILE_END") {
          const blob = new Blob(fileChunksRef.current)
          const url = URL.createObjectURL(blob)
          setDownloadUrl(url)
          setDownloadFileName(fileNameRef.current)
          addChatMessage("✅ Arquivo recebido com sucesso")
          setIsTransferring(false)
          setTransferProgress(100)

          toast({
            title: "Arquivo recebido",
            description: `${fileNameRef.current} está pronto para download`,
          })
        } else {
          addChatMessage(`👤 ${e.data}`)
        }
      } else {
        fileChunksRef.current.push(e.data)
        receivedSizeRef.current += e.data.byteLength
        const progress = Math.round((receivedSizeRef.current / fileSizeRef.current) * 100)
        setTransferProgress(progress)

        if (progress % 20 === 0) {
          addChatMessage(
            `📦 Recebido: ${formatFileSize(receivedSizeRef.current)}/${formatFileSize(fileSizeRef.current)}`,
          )
        }
      }
    }
  }

  const createConnection = async () => {
    setIsLoading(true)
    try {
      peerRef.current = new RTCPeerConnection()
      channelRef.current = peerRef.current.createDataChannel("chat")
      configureChannel(channelRef.current)

      peerRef.current.onicecandidate = (e) => {
        if (!e.candidate) {
          const offerString = btoa(JSON.stringify(peerRef.current?.localDescription))
          setOffer(offerString)
        }
      }

      const offerDescription = await peerRef.current.createOffer()
      await peerRef.current.setLocalDescription(offerDescription)

      toast({
        title: "Conexão criada",
        description: "Compartilhe o código de conexão com seu convidado",
      })
    } catch (error) {
      console.error("Erro ao criar conexão:", error)
      setIsLoading(false)
      toast({
        title: "Erro de conexão",
        description: "Falha ao criar conexão",
        variant: "destructive",
      })
    }
  }

  const finalizeConnection = async () => {
    if (!peerRef.current || !answer) {
      toast({
        title: "Informação ausente",
        description: "Por favor, cole a resposta do convidado",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const answerObj = JSON.parse(atob(answer))
      await peerRef.current.setRemoteDescription(answerObj)

      toast({
        title: "Conexão estabelecida",
        description: "Agora você pode trocar mensagens e arquivos",
      })
    } catch (error) {
      console.error("Erro ao finalizar conexão:", error)
      setIsLoading(false)
      toast({
        title: "Erro de conexão",
        description: "Falha ao estabelecer conexão",
        variant: "destructive",
      })
    }
  }

  const respondToOffer = async () => {
    if (!guestOffer) {
      toast({
        title: "Informação ausente",
        description: "Por favor, cole a oferta do host",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const offerObj = JSON.parse(atob(guestOffer))
      peerRef.current = new RTCPeerConnection()

      peerRef.current.ondatachannel = (e) => {
        channelRef.current = e.channel
        configureChannel(channelRef.current)
      }

      peerRef.current.onicecandidate = (e) => {
        if (!e.candidate) {
          const answerString = btoa(JSON.stringify(peerRef.current?.localDescription))
          setGuestAnswer(answerString)
        }
      }

      await peerRef.current.setRemoteDescription(offerObj)
      const answerDescription = await peerRef.current.createAnswer()
      await peerRef.current.setLocalDescription(answerDescription)

      toast({
        title: "Resposta criada",
        description: "Compartilhe o código de resposta com o host",
      })
    } catch (error) {
      console.error("Erro ao responder oferta:", error)
      setIsLoading(false)
      toast({
        title: "Erro de conexão",
        description: "Falha ao processar a oferta",
        variant: "destructive",
      })
    }
  }

  const sendMessage = () => {
    if (!channelRef.current || channelRef.current.readyState !== "open" || !message.trim()) {
      return
    }

    channelRef.current.send(message)
    addChatMessage(`📤 ${message}`)
    setMessage("")
  }

  const sendFile = () => {
    if (!fileInputRef.current?.files?.length || !channelRef.current || channelRef.current.readyState !== "open") {
      toast({
        title: "Não é possível enviar arquivo",
        description: "Selecione um arquivo e verifique se a conexão está estabelecida",
        variant: "destructive",
      })
      return
    }

    const file = fileInputRef.current.files[0]
    channelRef.current.send(`FILE_META:${JSON.stringify({ name: file.name, size: file.size })}`)

    const reader = new FileReader()
    let offset = 0
    const CHUNK_SIZE = 16000
    setIsTransferring(true)

    reader.onload = (e) => {
      if (e.target?.result && channelRef.current) {
        channelRef.current.send(e.target.result)
        offset += (e.target.result as ArrayBuffer).byteLength

        const progress = Math.round((offset / file.size) * 100)
        setTransferProgress(progress)

        if (offset < file.size) {
          readNextChunk()
        } else {
          channelRef.current.send("FILE_END")
          addChatMessage("✅ Arquivo enviado com sucesso")
          setIsTransferring(false)

          toast({
            title: "Arquivo enviado",
            description: `${file.name} foi enviado com sucesso`,
          })

          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        }
      }
    }

    const readNextChunk = () => {
      const slice = file.slice(offset, offset + CHUNK_SIZE)
      reader.readAsArrayBuffer(slice)
    }

    addChatMessage(`📤 Enviando arquivo: ${file.name} (${formatFileSize(file.size)})`)
    readNextChunk()
  }

  const addChatMessage = (msg: string) => {
    setChatMessages((prev) => [...prev, msg])
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)

    toast({
      title: "Copiado para a área de transferência",
      description: "Agora você pode colar para compartilhar",
    })
  }

  const resetConnection = () => {
    if (channelRef.current) {
      channelRef.current.close()
    }
    if (peerRef.current) {
      peerRef.current.close()
    }

    peerRef.current = null
    channelRef.current = null
    setOffer("")
    setAnswer("")
    setGuestOffer("")
    setGuestAnswer("")
    setIsConnected(false)
    setDownloadUrl("")
    setDownloadFileName("")
    setIsTransferring(false)
    setTransferProgress(0)

    toast({
      title: "Conexão reiniciada",
      description: "Você pode criar uma nova conexão agora",
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " bytes"
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
    else return (bytes / 1048576).toFixed(1) + " MB"
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">Conexão P2P</h1>

      <div className="grid grid-cols-1 gap-8">
        <Tabs defaultValue="host" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="host" className="text-lg">
              🔵 Host
            </TabsTrigger>
            <TabsTrigger value="guest" className="text-lg">
              🟢 Convidado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="host" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Criar Conexão
                  {isConnected && <Badge className="bg-green-500">Conectado</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <Button onClick={createConnection} disabled={isConnected || isLoading} className="w-full">
                    {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : "Criar Conexão"}
                  </Button>

                  <div className="relative">
                    <Textarea
                      id="offer"
                      value={offer}
                      readOnly
                      placeholder="O código de conexão aparecerá aqui"
                      className="h-24 font-mono text-sm"
                    />
                    {offer && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(offer)}
                      >
                        {isCopied ? <Check size={16} /> : <Copy size={16} />}
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cole a resposta do convidado:</label>
                    <Textarea
                      id="answer"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Cole a resposta aqui"
                      className="h-24 font-mono text-sm"
                    />
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      onClick={finalizeConnection}
                      disabled={!offer || !answer }
                      className="flex-1"
                    >
                      Finalizar Conexão
                    </Button>
                    <Button variant="outline" onClick={resetConnection} className="flex-none">
                      Reiniciar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guest" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Entrar na Conexão
                  {isConnected && <Badge className="bg-green-500">Conectado</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cole a oferta do host:</label>
                    <Textarea
                      id="guestOffer"
                      value={guestOffer}
                      onChange={(e) => setGuestOffer(e.target.value)}
                      placeholder="Cole a oferta aqui"
                      className="h-24 font-mono text-sm"
                    />
                  </div>

                  <Button
                    onClick={respondToOffer}
                    disabled={!guestOffer || isConnected || isLoading}
                    className="w-full"
                  >
                    {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : "Responder à Oferta"}
                  </Button>

                  <div className="relative">
                    <Textarea
                      id="guestAnswer"
                      value={guestAnswer}
                      readOnly
                      placeholder="Sua resposta aparecerá aqui"
                      className="h-24 font-mono text-sm"
                    />
                    {guestAnswer && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(guestAnswer)}
                      >
                        {isCopied ? <Check size={16} /> : <Copy size={16} />}
                      </Button>
                    )}
                  </div>

                  <Button variant="outline" onClick={resetConnection}>
                    Reiniciar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>💬 Chat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                ref={chatContainerRef}
                className="h-64 overflow-y-auto p-4 border rounded-md bg-gray-50 dark:bg-gray-900"
              >
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p>Nenhuma mensagem ainda</p>
                    <p className="text-sm">Conecte-se com alguém para começar a conversar</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div key={index} className="mb-2 break-words">
                      {msg}
                    </div>
                  ))
                )}
              </div>

              <div className="flex space-x-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  disabled={!isConnected}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <Button onClick={sendMessage} disabled={!isConnected || !message.trim()}>
                  <Send size={18} />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📁 Transferência de Arquivos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col space-y-4">
                <div className="flex items-center space-x-2">
                  <Input type="file" ref={fileInputRef} disabled={!isConnected || isTransferring} className="flex-1" />
                  <Button onClick={sendFile} disabled={!isConnected || isTransferring}>
                    <Upload size={18} />
                  </Button>
                </div>

                {isTransferring && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Transferindo...</span>
                      <span>{transferProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${transferProgress}%` }}></div>
                    </div>
                  </div>
                )}

                {downloadUrl && (
                  <div className="flex items-center space-x-2 p-3 border rounded-md bg-gray-50 dark:bg-gray-900">
                    <Download size={18} />
                    <a
                      href={downloadUrl}
                      download={downloadFileName}
                      className="text-blue-600 hover:underline flex-1 truncate"
                    >
                      {downloadFileName}
                    </a>
                  </div>
                )}

                {!isConnected && (
                  <div className="flex flex-col items-center justify-center p-6 text-gray-400 border rounded-md">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p>Não conectado</p>
                    <p className="text-sm text-center">Estabeleça uma conexão para enviar e receber arquivos</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

