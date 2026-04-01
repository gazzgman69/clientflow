import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Music, Edit, Trash, Clock, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Repertoire } from "@shared/schema";

const songSchema = z.object({
  title: z.string().min(1, "Title is required"),
  artist: z.string().optional(),
  genre: z.string().optional(),
  key: z.string().optional(),
  tempo: z.string().optional(),
  duration: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

type SongFormData = z.infer<typeof songSchema>;

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RepertoirePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Repertoire | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: songs = [], isLoading } = useQuery<Repertoire[]>({
    queryKey: ["/api/repertoire"],
  });

  const form = useForm<SongFormData>({
    resolver: zodResolver(songSchema),
    defaultValues: { title: "", artist: "", genre: "", key: "", tempo: "", duration: "", notes: "", isActive: true },
  });

  const createMutation = useMutation({
    mutationFn: (data: SongFormData) => apiRequest("POST", "/api/repertoire", {
      ...data,
      tempo: data.tempo ? parseInt(data.tempo) : undefined,
      duration: data.duration ? parseInt(data.duration) * 60 : undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/repertoire"] }); setIsDialogOpen(false); form.reset(); toast({ title: "Song added" }); },
    onError: () => toast({ title: "Failed to add song", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SongFormData }) => apiRequest("PATCH", `/api/repertoire/${id}`, {
      ...data,
      tempo: data.tempo ? parseInt(data.tempo) : undefined,
      duration: data.duration ? parseInt(data.duration) * 60 : undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/repertoire"] }); setIsDialogOpen(false); setSelectedSong(null); form.reset(); toast({ title: "Song updated" }); },
    onError: () => toast({ title: "Failed to update song", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/repertoire/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/repertoire"] }); toast({ title: "Song deleted" }); },
    onError: () => toast({ title: "Failed to delete song", variant: "destructive" }),
  });

  const handleEdit = (song: Repertoire) => {
    setSelectedSong(song);
    form.reset({
      title: song.title, artist: song.artist || "", genre: song.genre || "",
      key: song.key || "", tempo: song.tempo?.toString() || "",
      duration: song.duration ? Math.round(song.duration / 60).toString() : "",
      notes: song.notes || "", isActive: (song as any).isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => { setIsDialogOpen(false); setSelectedSong(null); form.reset(); };

  const filtered = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.artist?.toLowerCase().includes(search.toLowerCase()) ||
    s.genre?.toLowerCase().includes(search.toLowerCase())
  );

  const genres = [...new Set(songs.map(s => s.genre).filter(Boolean))];

  if (isLoading) return <div className="container mx-auto py-8">Loading...</div>;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repertoire</h1>
          <p className="text-muted-foreground mt-1">{songs.length} songs in your library</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Song</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedSong ? "Edit Song" : "Add Song"}</DialogTitle>
              <DialogDescription>Add a song to your repertoire library.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => selectedSong ? updateMutation.mutate({ id: selectedSong.id, data: d }) : createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="artist" render={({ field }) => (<FormItem><FormLabel>Artist / Original</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="genre" render={({ field }) => (<FormItem><FormLabel>Genre</FormLabel><FormControl><Input {...field} placeholder="Pop, Jazz, Soul..." /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="key" render={({ field }) => (<FormItem><FormLabel>Key</FormLabel><FormControl><Input {...field} placeholder="C, Eb, F#..." /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="tempo" render={({ field }) => (<FormItem><FormLabel>Tempo (BPM)</FormLabel><FormControl><Input {...field} type="number" placeholder="120" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="duration" render={({ field }) => (<FormItem><FormLabel>Duration (minutes)</FormLabel><FormControl><Input {...field} type="number" step="0.5" placeholder="3.5" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} rows={2} placeholder="Key changes, tempo notes, special instructions..." /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex items-center justify-between border rounded p-3">
                    <div><FormLabel>Active</FormLabel><p className="text-xs text-muted-foreground">Inactive songs won't appear in setlist builder</p></div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : selectedSong ? "Update Song" : "Add Song"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 items-center">
        <Input placeholder="Search songs, artists, genres..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {genres.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {genres.map(g => (
              <Badge key={g} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => setSearch(g!)}>{g}</Badge>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Music className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{search ? "No songs match your search" : "No songs yet"}</h3>
          {!search && <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Add First Song</Button>}
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>BPM</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((song) => (
                  <TableRow key={song.id} className={(song as any).isActive === false ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {song.title}
                      {(song as any).isActive === false && <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{song.artist}</TableCell>
                    <TableCell>{song.genre && <Badge variant="outline" className="text-xs">{song.genre}</Badge>}</TableCell>
                    <TableCell>{song.key && <Badge variant="secondary" className="text-xs">{song.key}</Badge>}</TableCell>
                    <TableCell>
                      {song.tempo && <div className="flex items-center gap-1 text-sm"><Activity className="h-3 w-3" />{song.tempo}</div>}
                    </TableCell>
                    <TableCell>
                      {song.duration && <div className="flex items-center gap-1 text-sm"><Clock className="h-3 w-3" />{formatDuration(song.duration)}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(song)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(song.id)}><Trash className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
