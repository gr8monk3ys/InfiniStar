import {
  buildCharacterJsonLd,
  buildCreatorJsonLd,
  type BreadcrumbListNode,
  type CharacterJsonLdInput,
  type CreatorJsonLdInput,
  type ProductNode,
} from "@/app/lib/structured-data"

const BASE = "https://infinistar.app"

const isProduct = (n: ProductNode | BreadcrumbListNode): n is ProductNode =>
  n["@type"] === "Product"
const isBreadcrumb = (n: ProductNode | BreadcrumbListNode): n is BreadcrumbListNode =>
  n["@type"] === "BreadcrumbList"

const character: CharacterJsonLdInput = {
  name: "Aria the Bard",
  slug: "aria-the-bard",
  tagline: "A wandering storyteller",
  description: "Aria spins tales of forgotten realms.",
  avatarUrl: "https://cdn.example.com/aria.png",
  category: "fantasy",
  usageCount: 1234,
  likeCount: 56,
  commentCount: 7,
  createdById: "11111111-1111-4111-8111-111111111111",
  createdByName: "Lorenzo",
}

const creator: CreatorJsonLdInput = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Lorenzo",
  bio: "Builds fantasy companions.",
  image: "https://cdn.example.com/lorenzo.png",
}

describe("buildCharacterJsonLd", () => {
  it("emits a Product node and a BreadcrumbList node in an @graph", () => {
    const jsonLd = buildCharacterJsonLd(character, BASE)
    expect(jsonLd["@context"]).toBe("https://schema.org")
    expect(Array.isArray(jsonLd["@graph"])).toBe(true)
    const types = jsonLd["@graph"].map((n) => n["@type"])
    expect(types).toContain("Product")
    expect(types).toContain("BreadcrumbList")
  })

  it("sets an absolute canonical url and name on the Product node", () => {
    const jsonLd = buildCharacterJsonLd(character, BASE)
    const product = jsonLd["@graph"].find(isProduct)!
    expect(product.name).toBe("Aria the Bard")
    expect(product.url).toBe("https://infinistar.app/characters/aria-the-bard")
    expect(product.image).toBe("https://cdn.example.com/aria.png")
    expect(product.description).toBe("A wandering storyteller")
  })

  it("maps likeCount to aggregateRating ratingCount and usageCount to an InteractionCounter", () => {
    const jsonLd = buildCharacterJsonLd(character, BASE)
    const product = jsonLd["@graph"].find(isProduct)!
    expect(product.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: 56,
      bestRating: "5",
      worstRating: "1",
    })
    expect(product.interactionStatistic).toEqual({
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/InteractAction",
      userInteractionCount: 1234,
    })
  })

  it("maps createdBy to an author Person with an absolute creator url", () => {
    const jsonLd = buildCharacterJsonLd(character, BASE)
    const product = jsonLd["@graph"].find(isProduct)!
    expect(product.author).toEqual({
      "@type": "Person",
      name: "Lorenzo",
      url: "https://infinistar.app/creators/11111111-1111-4111-8111-111111111111",
    })
  })

  it("omits aggregateRating when there are zero likes", () => {
    const jsonLd = buildCharacterJsonLd({ ...character, likeCount: 0 }, BASE)
    const product = jsonLd["@graph"].find(isProduct)!
    expect(product.aggregateRating).toBeUndefined()
  })

  it("builds breadcrumb items Home > Explore > category > character with absolute urls", () => {
    const jsonLd = buildCharacterJsonLd(character, BASE)
    const crumbs = jsonLd["@graph"].find(isBreadcrumb)!
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://infinistar.app/" },
      { "@type": "ListItem", position: 2, name: "Explore", item: "https://infinistar.app/explore" },
      {
        "@type": "ListItem",
        position: 3,
        name: "Fantasy",
        item: "https://infinistar.app/explore?category=fantasy",
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Aria the Bard",
        item: "https://infinistar.app/characters/aria-the-bard",
      },
    ])
  })

  it("falls back to the description and category display name when fields are missing", () => {
    const jsonLd = buildCharacterJsonLd(
      { ...character, tagline: null, category: "unknown-cat" },
      BASE
    )
    const product = jsonLd["@graph"].find(isProduct)!
    expect(product.description).toBe("Aria spins tales of forgotten realms.")
    const crumbs = jsonLd["@graph"].find(isBreadcrumb)!
    // getCategoryName returns "General" for unknown ids
    expect(crumbs.itemListElement[2].name).toBe("General")
  })
})

describe("buildCreatorJsonLd", () => {
  it("emits a ProfilePage with a Person mainEntity and absolute url", () => {
    const jsonLd = buildCreatorJsonLd(creator, BASE)
    expect(jsonLd["@context"]).toBe("https://schema.org")
    expect(jsonLd["@type"]).toBe("ProfilePage")
    expect(jsonLd.mainEntity).toEqual({
      "@type": "Person",
      name: "Lorenzo",
      description: "Builds fantasy companions.",
      image: "https://cdn.example.com/lorenzo.png",
      url: "https://infinistar.app/creators/22222222-2222-4222-8222-222222222222",
    })
  })

  it("falls back to a generic name and omits description/image when absent", () => {
    const jsonLd = buildCreatorJsonLd({ id: creator.id, name: null, bio: null, image: null }, BASE)
    const person = jsonLd.mainEntity
    expect(person.name).toBe("Anonymous")
    expect(person.description).toBeUndefined()
    expect(person.image).toBeUndefined()
  })
})
