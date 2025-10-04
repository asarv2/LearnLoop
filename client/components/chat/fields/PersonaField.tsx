"use client";

import { useParametersByField } from "@/lib/api/hooks/useParameters";
import { usePersonas } from "@/lib/api/hooks/usePersonas";
import {
  CheckIcon,
  Cross2Icon,
  SpeakerLoudIcon,
  UploadIcon,
} from "@radix-ui/react-icons";
import { Box, Button, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import type { PersonaFieldProps } from "./types";

export default function PersonaField({
  field,
  onChange,
  selectedParameterId,
  customPersonaName,
  setCustomPersonaName,
  customPersonaDescription,
  setCustomPersonaDescription,
  customVoiceType,
  setCustomVoiceType,
  customVoiceFile,
  setCustomVoiceFile,
  customVoiceUrl,
  setCustomVoiceUrl,
}: PersonaFieldProps) {
  const { data: parameters, isLoading } = useParametersByField(field.id);
  const { data: personas } = usePersonas();
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioProgress, setAudioProgress] = useState<{
    current: number;
    duration: number;
  }>({
    current: 0,
    duration: 0,
  });
  const progressUpdateIntervalRef = useRef<number | null>(null);

  // Custom persona state
  const [isCustomPersonaSelected, setIsCustomPersonaSelected] = useState(false);

  // Custom voice upload state
  const [isPlayingCustomVoice, setIsPlayingCustomVoice] = useState(false);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync internal state with parent when selectedParameterId changes
  useEffect(() => {
    if (selectedParameterId && selectedParameterId !== selectedPersonaId) {
      setSelectedPersonaId(selectedParameterId);
      // If an explicit persona is selected via props, ensure Custom is unselected
      setIsCustomPersonaSelected(false);
    }
  }, [selectedParameterId, selectedPersonaId]);

  // Handle voice file upload
  const handleVoiceFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (
        !file.type.startsWith("audio/") &&
        !file.name.toLowerCase().endsWith(".wav")
      ) {
        alert("Please select a valid audio file (.wav)");
        return;
      }

      setCustomVoiceFile(file);
      setCustomVoiceType(""); // Clear voice type selection

      // Create local URL for preview
      const url = URL.createObjectURL(file);
      setCustomVoiceUrl(url);
    }
  };

  // Handle remove custom voice
  const handleRemoveCustomVoice = () => {
    setCustomVoiceFile(null);
    setCustomVoiceUrl(null);
    if (customVoiceUrl) {
      URL.revokeObjectURL(customVoiceUrl);
    }
  };

  // Handle custom voice playback
  const handlePlayCustomVoice = () => {
    if (customAudioRef.current) {
      if (isPlayingCustomVoice) {
        customAudioRef.current.pause();
        setIsPlayingCustomVoice(false);
      } else {
        customAudioRef.current.play();
        setIsPlayingCustomVoice(true);
      }
    }
  };

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (customVoiceUrl) {
        URL.revokeObjectURL(customVoiceUrl);
      }
    };
  }, [customVoiceUrl]);

  const colors = [
    "var(--green-2)",
    "var(--blue-2)",
    "var(--purple-2)",
    "var(--orange-2)",
    "var(--red-2)",
    "var(--gold-2)",
  ];

  const borderColors = [
    "var(--green-7)",
    "var(--blue-7)",
    "var(--purple-7)",
    "var(--orange-7)",
    "var(--red-7)",
    "var(--gold-7)",
  ];

  const dotColors = [
    "var(--green-9)",
    "var(--blue-9)",
    "var(--purple-9)",
    "var(--orange-9)",
    "var(--red-9)",
    "var(--gold-9)",
  ];

  const handlePersonaSelect = (parameterId: string) => {
    const p = parameters?.find((pp) => pp.id === parameterId);
    if (p && p.value === null) {
      // Select sentinel "Custom" and focus the custom input
      setIsCustomPersonaSelected(true);
      setSelectedPersonaId("");
      onChange("Custom", undefined);
    } else {
      setIsCustomPersonaSelected(false);
      setSelectedPersonaId(parameterId);
      onChange(parameterId, parameterId);
    }
  };

  const handlePlayAudio = async (audioId: string) => {
    const cleanupAudio = () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
        progressUpdateIntervalRef.current = null;
      }
      setAudioProgress({ current: 0, duration: 0 });
    };

    try {
      if (playingAudioId === audioId) {
        cleanupAudio();
        setPlayingAudioId(null);
        return;
      }

      // Stop any currently playing audio
      cleanupAudio();

      const audio = new Audio(`/api/v1/audio/${audioId}`);
      audioRef.current = audio;
      setPlayingAudioId(audioId);

      const handleLoaded = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        setAudioProgress({ current: 0, duration });

        // Start smooth progress updates
        if (progressUpdateIntervalRef.current) {
          clearInterval(progressUpdateIntervalRef.current);
        }
        progressUpdateIntervalRef.current = window.setInterval(() => {
          if (audioRef.current && !audioRef.current.paused) {
            const current = audioRef.current.currentTime || 0;
            const duration = Number.isFinite(audioRef.current.duration)
              ? audioRef.current.duration
              : 0;
            setAudioProgress({ current, duration });
          }
        }, 50); // Update every 50ms for smooth animation
      };
      const handleTimeUpdate = () => {
        // Keep this as backup, but the interval will handle smooth updates
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        setAudioProgress({ current: audio.currentTime || 0, duration });
      };
      const handleEnded = () => {
        setPlayingAudioId(null);
        cleanupAudio();
      };
      const handleError = () => {
        console.error("Error playing audio");
        setPlayingAudioId(null);
        cleanupAudio();
      };

      audio.addEventListener("loadedmetadata", handleLoaded);
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("error", handleError as EventListener);

      await audio.play();
    } catch (error) {
      console.error("Error playing audio:", error);
      setPlayingAudioId(null);
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
        audioRef.current = null;
      }
      setAudioProgress({ current: 0, duration: 0 });
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
        audioRef.current = null;
      }
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
        progressUpdateIntervalRef.current = null;
      }
    };
  }, []);

  if (isLoading) return <Spinner size="2" />;

  // Filter out custom persona parameters (one-time use) and only include active personas
  const displayedParameters = parameters
    ?.filter((p) => {
      // Always include the currently selected parameter
      if (selectedParameterId && p.id === selectedParameterId) return true;
      return (
        (p.description || "").toLowerCase() !==
          `custom ${field.name?.toLowerCase() || "persona"}` &&
        (p.description || "").trim() !== ""
      );
    })
    ?.filter((p) => {
      // Always include the currently selected parameter
      if (selectedParameterId && p.id === selectedParameterId) return true;
      const persona = personas?.find((pp) => pp.id === p.value);
      return persona?.active === true;
    });

  return (
    <Flex direction="column" gap="3">
      {displayedParameters
        ?.sort((a, b) => b.updated_at?.localeCompare(a.updated_at || "") || 0)
        .map((parameter, index) => {
          // Custom sentinel is determined by value === null
          const isCustom = parameter.value === null;
          const isSelected =
            selectedPersonaId === parameter.id ||
            (isCustom &&
              (selectedParameterId === undefined || isCustomPersonaSelected));
          const colorIndex = index % colors.length;
          // Remove "Employee" from the end of the parameter name for display
          const displayName = (parameter.name || "Unnamed Parameter").replace(
            /\s+Employee$/i,
            ""
          );

          return (
            <Card
              key={parameter.id!}
              style={{
                background: isSelected ? colors[colorIndex] : "var(--gray-1)",
                border: `2px solid ${
                  isSelected ? borderColors[colorIndex] : "var(--gray-6)"
                }`,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onClick={() => handlePersonaSelect(parameter.id!)}
            >
              <Box p="4">
                <Flex direction="column" gap="3">
                  <Flex align="center" gap="3">
                    <Box
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: `2px solid ${
                          isSelected ? dotColors[colorIndex] : "var(--gray-6)"
                        }`,
                        background: isSelected
                          ? dotColors[colorIndex]
                          : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && (
                        <CheckIcon width="12" height="12" color="white" />
                      )}
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <Text size="3" weight="bold">
                        {displayName}:
                      </Text>
                      {parameter.description && (
                        <Text size="2" color="gray">
                          {` ${parameter.description}`}
                        </Text>
                      )}
                    </Box>
                    <Button
                      size="1"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayAudio(parameter.value!);
                      }}
                      style={{
                        padding: "6px",
                        borderRadius: "6px",
                        background: "transparent",
                        color:
                          playingAudioId === parameter.value
                            ? "var(--red-9)"
                            : "var(--blue-9)",
                        border:
                          playingAudioId === parameter.value
                            ? "2px solid var(--red-7)"
                            : "2px solid var(--blue-7)",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {(() => {
                        const isPlaying = playingAudioId === parameter.value;
                        if (!isPlaying)
                          return <SpeakerLoudIcon width="12" height="12" />;
                        const radius = 16;
                        const circumference = 2 * Math.PI * radius;
                        const progress =
                          audioProgress.duration > 0
                            ? Math.min(
                                1,
                                audioProgress.current / audioProgress.duration
                              )
                            : 0;
                        const dashOffset = circumference * (1 - progress);
                        return (
                          <div
                            style={{
                              position: "relative",
                              width: 18,
                              height: 18,
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 36 36">
                              <circle
                                cx="18"
                                cy="18"
                                r="16"
                                stroke="var(--gray-7)"
                                strokeWidth="4"
                                fill="none"
                              />
                              <circle
                                cx="18"
                                cy="18"
                                r="16"
                                stroke="var(--blue-9)"
                                strokeWidth="4"
                                fill="none"
                                strokeDasharray={`${circumference}`}
                                strokeDashoffset={`${dashOffset}`}
                                transform="rotate(-90 18 18)"
                              />
                            </svg>
                          </div>
                        );
                      })()}
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            </Card>
          );
        })}

      {/* Custom Persona Option - Similar to Categorical Custom */}
      <Card
        style={{
          background: isCustomPersonaSelected
            ? "var(--violet-2)"
            : "var(--gray-1)",
          border: `2px solid ${
            isCustomPersonaSelected ? "var(--violet-7)" : "var(--gray-6)"
          }`,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onClick={() => {
          // Find the sentinel parameter with value === null
          const sentinelParam = parameters?.find((p) => p.value === null);
          if (sentinelParam) {
            handlePersonaSelect(sentinelParam.id!);
          }
        }}
      >
        <Box p="4">
          <Flex direction="column" gap="3">
            <Flex align="center" gap="3">
              <Box
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  border: `2px solid ${
                    isCustomPersonaSelected
                      ? "var(--violet-9)"
                      : "var(--gray-6)"
                  }`,
                  background: isCustomPersonaSelected
                    ? "var(--violet-9)"
                    : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {isCustomPersonaSelected && (
                  <CheckIcon width="12" height="12" color="white" />
                )}
              </Box>
              <Box style={{ flex: 1 }}>
                <Text size="3" weight="bold">
                  Custom:
                </Text>
                <Text size="2" color="gray" style={{ paddingLeft: "4px" }}>
                  Create {field.name?.toLowerCase() || "persona"} with custom
                  name and voice
                </Text>
              </Box>
            </Flex>

            {/* Custom Persona Form - Only show when selected */}
            {isCustomPersonaSelected && (
              <Box
                style={{ marginLeft: "44px" }}
                onClick={(e) => e.stopPropagation()}
              >
                <Flex direction="row" gap="3" align="center">
                  {/* Name input - 60% width */}
                  <Box style={{ flex: "0 0 60%" }}>
                    <input
                      type="text"
                      placeholder={`Enter ${
                        field.name?.toLowerCase() || "persona"
                      } name...`}
                      value={customPersonaName}
                      onChange={(e) => setCustomPersonaName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: `1px solid ${
                          customPersonaName ? "var(--green-7)" : "var(--gray-6)"
                        }`,
                        fontSize: "16px",
                        outline: "none",
                        background: "white",
                      }}
                    />
                  </Box>
                  {/* Voice selector - 40% width */}
                  <Box style={{ flex: "0 0 40%" }}>
                    {customVoiceFile ? (
                      // Show audio player when custom voice is uploaded
                      <Flex align="center" gap="2">
                        <Button
                          size="2"
                          variant="soft"
                          onClick={handlePlayCustomVoice}
                          style={{
                            flex: 1,
                            background: isPlayingCustomVoice
                              ? "var(--green-3)"
                              : "var(--gray-3)",
                            color: isPlayingCustomVoice
                              ? "var(--green-11)"
                              : "var(--gray-11)",
                            border: "1px solid var(--gray-6)",
                            borderRadius: "8px",
                            padding: "12px 16px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "16px",
                            height: "48px",
                            marginRight: "12px",
                          }}
                        >
                          <SpeakerLoudIcon width="16" height="16" />
                          <Text size="2">
                            {isPlayingCustomVoice ? "Playing..." : "Play Voice"}
                          </Text>
                        </Button>
                        <Button
                          size="2"
                          variant="ghost"
                          onClick={handleRemoveCustomVoice}
                          style={{
                            background: "var(--red-3)",
                            color: "var(--red-11)",
                            border: "1px solid var(--red-6)",
                            borderRadius: "8px",
                            padding: "0",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: "auto",
                            width: "44px",
                            height: "44px",
                            marginRight: "2px",
                          }}
                        >
                          <Cross2Icon width="18" height="18" />
                        </Button>
                        <audio
                          ref={customAudioRef}
                          src={customVoiceUrl || undefined}
                          onEnded={() => setIsPlayingCustomVoice(false)}
                          onError={() => {
                            setIsPlayingCustomVoice(false);
                            alert("Error playing audio file");
                          }}
                        />
                      </Flex>
                    ) : (
                      // Show voice selector and upload button
                      <Flex align="center" gap="2">
                        <select
                          value={customVoiceType}
                          onChange={(e) => setCustomVoiceType(e.target.value)}
                          style={{
                            flex: 1,
                            padding: "12px 16px",
                            paddingRight: "40px",
                            borderRadius: "8px",
                            border: `1px solid ${
                              customVoiceType
                                ? "var(--green-7)"
                                : "var(--gray-6)"
                            }`,
                            fontSize: "16px",
                            outline: "none",
                            background: "white",
                            appearance: "none",
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: "right 12px center",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "16px 16px",
                          }}
                        >
                          <option value="">Select voice...</option>
                          {displayedParameters?.map((param) => {
                            const persona = personas?.find(
                              (p) => p.id === param.value
                            );
                            const firstName = persona?.name?.split(" ")[0];
                            return (
                              <option
                                key={param.id}
                                value={String(param.value)}
                              >
                                {firstName ||
                                  param.name?.replace(/\s+Employee$/i, "") ||
                                  "Unknown"}
                                &apos;s Voice
                              </option>
                            );
                          })}
                        </select>
                        <input
                          type="file"
                          accept=".wav,audio/*"
                          onChange={handleVoiceFileUpload}
                          style={{ display: "none" }}
                          id={`voice-upload-${field.id}`}
                        />
                        <Button
                          size="2"
                          variant="soft"
                          onClick={() =>
                            document
                              .getElementById(`voice-upload-${field.id}`)
                              ?.click()
                          }
                          style={{
                            background: "var(--violet-3)",
                            color: "var(--violet-11)",
                            border: "1px solid var(--violet-6)",
                            borderRadius: "8px",
                            padding: "10px 14px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: "auto",
                            width: "44px",
                            height: "44px",
                          }}
                        >
                          <UploadIcon width="18" height="18" />
                        </Button>
                      </Flex>
                    )}
                  </Box>
                </Flex>

                {/* Description field - aligned with upload button */}
                <Box style={{ marginTop: "12px", marginRight: "-12px" }}>
                  <textarea
                    placeholder={`Enter ${
                      field.name?.toLowerCase() || "persona"
                    } description...`}
                    value={customPersonaDescription}
                    onChange={(e) =>
                      setCustomPersonaDescription(e.target.value)
                    }
                    rows={1}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      border: `1px solid ${
                        customPersonaDescription
                          ? "var(--green-7)"
                          : "var(--gray-6)"
                      }`,
                      fontSize: "16px",
                      outline: "none",
                      background: "white",
                      resize: "vertical",
                      minHeight: "80px",
                    }}
                  />
                </Box>
              </Box>
            )}
          </Flex>
        </Box>
      </Card>
    </Flex>
  );
}
