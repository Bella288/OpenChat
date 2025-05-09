import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { updateUserProfileSchema } from "@shared/schema";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Create a form schema
const profileFormSchema = z.object({
  fullName: z.string().optional(),
  location: z.string().optional(),
  interests: z.array(z.string()).optional(),
  interestsInput: z.string().optional(), // For input field value only, not submitted
  profession: z.string().optional(),
  pets: z.string().optional(),
  systemContext: z.string().optional(),
  additionalInfo: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserSettingsModal({
  isOpen,
  onClose,
}: UserSettingsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Create form with default values
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: "",
      location: "",
      interests: [],
      interestsInput: "",
      profession: "",
      pets: "",
      systemContext: "",
      additionalInfo: "",
    },
  });

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      // Convert interests array to comma-separated string for display
      const interestsString = user.interests?.join(", ") || "";
      
      form.reset({
        fullName: user.fullName || "",
        location: user.location || "",
        interests: user.interests || [],
        interestsInput: interestsString,
        profession: user.profession || "",
        pets: user.pets || "",
        systemContext: user.systemContext || "",
      });
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update profile");
      }
      return await res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    // Create a copy of the data object without interestsInput
    const { interestsInput, ...submitData } = data;
    
    // Submit data without the temporary interestsInput field
    await updateProfileMutation.mutateAsync(submitData);
  };

  // Convert string to array for interests field if needed
  const handleInterestsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Just store the input value as is, don't process it yet
    form.setValue("interestsInput", value);
    
    // Process for the actual interests field that gets submitted
    const interestsArray = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
    form.setValue("interests", interestsArray);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Settings</DialogTitle>
          <DialogDescription>
            Update your profile information and AI assistant preferences
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              {/* Profile Information Section */}
              <div className="border-b pb-2">
                <h3 className="text-lg font-medium">Profile Information</h3>
              </div>
              
              <FormField
                control={form.control}
                name="profileImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Picture</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-4">
                        <img 
                          src={field.value || (user?.profileImage || user?.replitProfileImage) || 'https://github.com/shadcn.png'} 
                          alt="Profile" 
                          className="h-16 w-16 rounded-full object-cover border"
                          onError={(e) => {
                            e.currentTarget.src = 'https://github.com/shadcn.png';
                          }}
                        />
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/gif"
                            onChange={async (e) => {
                              try {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                // Validate file size
                                if (file.size > 5 * 1024 * 1024) {
                                  throw new Error('File size must be less than 5MB');
                                }

                                const formData = new FormData();
                                formData.append('image', file);

                                const res = await fetch('/api/user/profile-image', {
                                  method: 'POST',
                                  body: formData,
                                  credentials: 'include'
                                });

                                if (!res.ok) {
                                  const error = await res.json();
                                  throw new Error(error.message || 'Failed to upload image');
                                }

                                const { imageUrl } = await res.json();
                                field.onChange(imageUrl);
                                
                                toast({
                                  title: "Success",
                                  description: "Profile image updated successfully",
                                });
                              } catch (error: any) {
                                console.error('Error uploading image:', error);
                                toast({
                                  title: "Upload failed",
                                  description: error.message || "Failed to upload profile image",
                                  variant: "destructive"
                                });
                                // Reset the input
                                e.target.value = '';
                              }
                            }}
                          />
                          <FormDescription className="mt-1">
                            Maximum file size: 5MB. Supported formats: JPEG, PNG, GIF
                          </FormDescription>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your full name" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Your location" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="profession"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profession</FormLabel>
                    <FormControl>
                      <Input placeholder="Your profession" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interestsInput"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interests</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Interests (comma-separated)"
                        {...field}
                        onChange={handleInterestsChange}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter your interests separated by commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pets"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pets</FormLabel>
                    <FormControl>
                      <Input placeholder="Your pets" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* AI Assistant Preferences Section */}
              <div className="border-b pb-2 pt-4">
                <h3 className="text-lg font-medium">AI Assistant Preferences</h3>
              </div>

              <FormField
                control={form.control}
                name="additionalInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Information</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Share more about yourself - hobbies, preferences, communication style, areas of expertise, or any context that would help the AI understand you better"
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      This information helps personalize AI responses. Include your preferred communication style, 
                      expertise areas, or any other context you'd like the AI to consider.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <FormLabel className="text-base">System Context</FormLabel>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Generate structured context from profile fields
                      const fullName = form.getValues("fullName");
                      const location = form.getValues("location");
                      const interests = form.getValues("interests");
                      const profession = form.getValues("profession");
                      const pets = form.getValues("pets");
                      const additionalInfo = form.getValues("additionalInfo");
                      
                      // Format profile information in a structured way
                      let profileInfo = "USER PROFILE:\n";
                      if (fullName) profileInfo += `Name: ${fullName}\n`;
                      if (location) profileInfo += `Location: ${location}\n`;
                      if (interests && interests.length > 0) profileInfo += `Interests: ${interests.join(", ")}\n`;
                      if (profession) profileInfo += `Profession: ${profession}\n`;
                      if (pets) profileInfo += `Pets: ${pets}\n`;
                      if (additionalInfo) profileInfo += `\nADDITIONAL CONTEXT:\n${additionalInfo}\n`;
                      
                      // Get existing context
                      const currentContext = form.getValues("systemContext") || "";
                      
                      // Set the new structured context
                      form.setValue("systemContext", profileInfo + "\n" + currentContext);
                    }}
                  >
                    Include Profile Info
                  </Button>
                </div>
                
                <FormField
                  control={form.control}
                  name="systemContext"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Add custom context for the AI assistant to understand your requirements better"
                          className="min-h-[150px]"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        This context will be provided to the AI assistant for all your conversations. 
                        Use key-value pairs like "name: Your Name" for best results.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateProfileMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}